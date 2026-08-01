package architecture.fixture;

import jakarta.servlet.http.Cookie;

/** Deliberate ArchUnit negative fixture; it must never be moved into production sources. */
public final class CookieReadingController {
    private final Cookie cookie = new Cookie("forbidden", "fixture");

    public Cookie cookie() {
        return cookie;
    }
}
