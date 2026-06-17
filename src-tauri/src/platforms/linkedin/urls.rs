pub fn normalize_profile_url(raw: &str) -> Result<String, String> {
    let mut text = raw.trim();
    if text.is_empty() {
        return Err("profile_url is required".into());
    }

    if let Some(stripped) = text.strip_prefix('@') {
        text = stripped.trim();
    }

    let lower = text.to_ascii_lowercase();
    let with_scheme = if lower.starts_with("linkedin.com/") || lower.starts_with("www.linkedin.com/") {
        format!("https://{text}")
    } else if lower.starts_with("http://") || lower.starts_with("https://") {
        text.to_string()
    } else if text.starts_with('/') {
        format!("https://www.linkedin.com{text}")
    } else if text.starts_with("in/") {
        format!("https://www.linkedin.com/{text}")
    } else if !text.contains('/') && is_vanity_username(text) {
        format!("https://www.linkedin.com/in/{text}/")
    } else {
        return Err(
            "profile_url must be a LinkedIn profile URL or username (e.g. jane-doe)".into(),
        );
    };

    let parsed = url::Url::parse(&with_scheme).map_err(|e| e.to_string())?;
    let host = parsed.host_str().unwrap_or("").trim_start_matches("www.");
    if host != "linkedin.com" {
        return Err(format!("unsupported host '{}' — use linkedin.com", host));
    }

    let path = parsed.path().trim_end_matches('/');
    if path.is_empty() {
        return Err("profile_url path is missing".into());
    }

    if path.contains("/recent-activity") {
        let base = path.split("/recent-activity").next().unwrap_or(path);
        return normalize_profile_url(&format!("https://www.linkedin.com{base}/"));
    }

    if let Some(rest) = path.strip_prefix("/in/") {
        let username = rest.split('/').next().unwrap_or("").trim();
        if username.is_empty() {
            return Err("LinkedIn member username is missing from profile path".into());
        }
        return Ok(format!("https://www.linkedin.com/in/{username}/"));
    }

    if let Some(rest) = path.strip_prefix("/company/") {
        let slug = rest.split('/').next().unwrap_or("").trim();
        if slug.is_empty() {
            return Err("company profile slug is missing".into());
        }
        return Ok(format!("https://www.linkedin.com/company/{slug}/"));
    }

    Err("profile_url must point to a LinkedIn member (/in/...) or company (/company/...) profile".into())
}

fn is_vanity_username(text: &str) -> bool {
    !text.is_empty()
        && text
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '%')
}

#[cfg(test)]
mod tests {
    use super::normalize_profile_url;

    #[test]
    fn bare_username() {
        assert_eq!(
            normalize_profile_url("protibimbok").unwrap(),
            "https://www.linkedin.com/in/protibimbok/"
        );
    }

    #[test]
    fn at_username() {
        assert_eq!(
            normalize_profile_url("@protibimbok").unwrap(),
            "https://www.linkedin.com/in/protibimbok/"
        );
    }
}
