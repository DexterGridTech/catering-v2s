package architecture.fixture.application;

/** Red mutation fixture: same method name, but no foundation helper call. */
public final class LocalCollectionParserFixture {
    private LocalCollectionParserFixture() {}

    private static int parsePageSize(String value, int fallback) {
        return value == null || value.isBlank() ? fallback : Integer.parseInt(value);
    }
}
