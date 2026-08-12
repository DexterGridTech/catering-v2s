package architecture;

import java.io.PrintWriter;
import org.junit.platform.engine.discovery.DiscoverySelectors;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.listeners.SummaryGeneratingListener;

/** Static selector bridge that runs the app architecture test without Docker-backed test task discovery. */
public final class BackendModuleBoundariesSelector {
    private BackendModuleBoundariesSelector() {
    }

    public static void main(String[] args) {
        LauncherDiscoveryRequest request = LauncherDiscoveryRequestBuilder.request()
            .selectors(DiscoverySelectors.selectClass("architecture.BackendModuleBoundariesTest"))
            .build();
        SummaryGeneratingListener listener = new SummaryGeneratingListener();
        Launcher launcher = LauncherFactory.create();
        launcher.registerTestExecutionListeners(listener);
        launcher.execute(request);
        var summary = listener.getSummary();
        summary.printTo(new PrintWriter(System.out));
        for (var failure : summary.getFailures()) {
            System.err.println("ARCHUNIT_SELECTOR_FAILURE=" + failure.getTestIdentifier().getDisplayName());
            failure.getException().printStackTrace(System.err);
        }
        if (summary.getTestsFoundCount() == 0 || !summary.getFailures().isEmpty()) {
            System.exit(1);
        }
    }
}
