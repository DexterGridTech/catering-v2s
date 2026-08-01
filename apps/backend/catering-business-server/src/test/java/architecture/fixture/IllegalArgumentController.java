package architecture.fixture;

/** Deliberate ArchUnit negative fixture: controller request failures must use a typed Problem mapping. */
public final class IllegalArgumentController {
    public void reject() {
        throw new IllegalArgumentException("forbidden framework-default request failure");
    }
}
