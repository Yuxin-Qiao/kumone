//! Deterministic unblock/source-matching policy shared by platform clients.
//!
//! Network transport and provider-specific scraping stay outside the core. This
//! module owns provider priority, candidate normalization and match scoring so
//! Android and Windows make the same fallback decision.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnblockProvider {
    Kuwo,
    Kugou,
    Pyncmd,
}

impl UnblockProvider {
    #[must_use]
    pub const fn priority(self) -> u8 {
        match self {
            Self::Kuwo => 0,
            Self::Kugou => 1,
            Self::Pyncmd => 2,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MatchTarget {
    pub title: String,
    pub artists: Vec<String>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnblockCandidate {
    pub provider: UnblockProvider,
    pub id: String,
    pub title: String,
    pub artists: Vec<String>,
    pub duration_ms: Option<u64>,
    pub url: Option<String>,
    pub bitrate: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct MatchScore(pub i32);

#[must_use]
pub fn score_candidate(target: &MatchTarget, candidate: &UnblockCandidate) -> MatchScore {
    let target_title = normalize(&target.title);
    let candidate_title = normalize(&candidate.title);
    if target_title.is_empty() || candidate_title.is_empty() {
        return MatchScore(i32::MIN / 2);
    }

    let mut score = if target_title == candidate_title {
        100
    } else if target_title.contains(&candidate_title) || candidate_title.contains(&target_title) {
        72
    } else {
        token_overlap(&target_title, &candidate_title) * 50
    };

    let target_artists: Vec<String> = target
        .artists
        .iter()
        .map(|value| normalize(value))
        .collect();
    let candidate_artists: Vec<String> = candidate
        .artists
        .iter()
        .map(|value| normalize(value))
        .collect();
    if target_artists.iter().any(|artist| {
        !artist.is_empty()
            && candidate_artists
                .iter()
                .any(|other| artist == other || artist.contains(other) || other.contains(artist))
    }) {
        score += 35;
    }

    if let (Some(expected), Some(actual)) = (target.duration_ms, candidate.duration_ms) {
        let delta = expected.abs_diff(actual);
        score += match delta {
            0..=1_500 => 20,
            1_501..=4_000 => 12,
            4_001..=8_000 => 4,
            _ => -20,
        };
    }

    if candidate.url.as_deref().is_some_and(|url| !url.is_empty()) {
        score += 5;
    }
    score -= i32::from(candidate.provider.priority());
    MatchScore(score)
}

#[must_use]
pub fn best_candidate<'a>(
    target: &MatchTarget,
    candidates: &'a [UnblockCandidate],
) -> Option<&'a UnblockCandidate> {
    candidates
        .iter()
        .filter(|candidate| candidate.url.as_deref().is_some_and(|url| !url.is_empty()))
        .max_by_key(|candidate| score_candidate(target, candidate))
        .filter(|candidate| score_candidate(target, candidate).0 >= 90)
}

#[must_use]
pub fn normalize(value: &str) -> String {
    value
        .chars()
        .flat_map(char::to_lowercase)
        .filter(|ch| ch.is_alphanumeric())
        .collect()
}

fn token_overlap(left: &str, right: &str) -> i32 {
    if left.is_empty() || right.is_empty() {
        return 0;
    }
    let shorter = if left.len() <= right.len() {
        left
    } else {
        right
    };
    let longer = if left.len() <= right.len() {
        right
    } else {
        left
    };
    let common = shorter.chars().filter(|ch| longer.contains(*ch)).count();
    ((common * 100) / shorter.chars().count().max(1)) as i32 / 100
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target() -> MatchTarget {
        MatchTarget {
            title: "夜曲".to_owned(),
            artists: vec!["周杰伦".to_owned()],
            duration_ms: Some(226_000),
        }
    }

    #[test]
    fn exact_title_artist_duration_wins() {
        let candidates = vec![
            UnblockCandidate {
                provider: UnblockProvider::Kugou,
                id: "bad".to_owned(),
                title: "夜曲 (Live)".to_owned(),
                artists: vec!["Other".to_owned()],
                duration_ms: Some(260_000),
                url: Some("https://bad".to_owned()),
                bitrate: None,
            },
            UnblockCandidate {
                provider: UnblockProvider::Kuwo,
                id: "good".to_owned(),
                title: "夜曲".to_owned(),
                artists: vec!["周杰伦".to_owned()],
                duration_ms: Some(226_500),
                url: Some("https://good".to_owned()),
                bitrate: Some(320_000),
            },
        ];
        assert_eq!(
            best_candidate(&target(), &candidates).map(|item| item.id.as_str()),
            Some("good")
        );
    }

    #[test]
    fn candidate_without_url_is_never_selected() {
        let candidates = vec![UnblockCandidate {
            provider: UnblockProvider::Kuwo,
            id: "missing".to_owned(),
            title: "夜曲".to_owned(),
            artists: vec!["周杰伦".to_owned()],
            duration_ms: Some(226_000),
            url: None,
            bitrate: None,
        }];
        assert!(best_candidate(&target(), &candidates).is_none());
    }

    #[test]
    fn normalization_ignores_spaces_punctuation_and_case() {
        assert_eq!(normalize("Hello, World!"), "helloworld");
    }
}
