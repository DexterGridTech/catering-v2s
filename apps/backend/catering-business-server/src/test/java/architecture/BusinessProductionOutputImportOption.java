package architecture;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.core.importer.Location;
import java.net.URI;

/** Limits business ArchUnit package scans to this deployable's production class outputs. */
public final class BusinessProductionOutputImportOption implements ImportOption {
    private static final String BUSINESS_SOURCE_ROOT = "/apps/backend/catering-business-server/";
    private static final String CLASSES_OUTPUT = "/build/classes/java/main";
    private static final String JAR_OUTPUT = "/build/libs/";

    @Override
    public boolean includes(Location location) {
        return includesProductionOutput(location.asURI());
    }

    static boolean includesProductionOutput(URI uri) {
        String location = uri.normalize().toString().replace('\\', '/');
        if (!location.contains(BUSINESS_SOURCE_ROOT) || location.contains("-test-fixtures.jar")) return false;
        return location.contains(CLASSES_OUTPUT)
                || (location.contains(JAR_OUTPUT) && location.matches(".*\\.jar(?:!/.*)?$"));
    }
}
