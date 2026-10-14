package com.catering.v2s.app.bootstrap;

import com.catering.v2s.platform.iam.api.PlatformUatRootBootstrap;
import com.catering.v2s.platform.iam.api.PlatformUatRootBootstrap.BootstrapReadback;
import java.util.Arrays;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

/** One-shot, non-web bootstrap for the canonical first administrator in the isolated UAT database. */
public final class ManagedUatPlatformBootstrap {
    private static final Logger LOG = LoggerFactory.getLogger(ManagedUatPlatformBootstrap.class);
    private static final String LOGIN_NAME = "root";
    private static final String DISPLAY_NAME = "平台超级管理员";
    private static final String IDEMPOTENCY_KEY = "v2s-uat-platform-root-bootstrap-v1";

    private ManagedUatPlatformBootstrap() {}

    public static void main(String[] args) throws Exception {
        Input input = Input.from(System.getenv());
        char[] password = input.password();
        try {
            try (ConfigurableApplicationContext context = new SpringApplicationBuilder(CateringV2sApplication.class)
                    .web(WebApplicationType.NONE)
                    .logStartupInfo(false)
                    .properties("spring.main.banner-mode=off", "spring.main.lazy-initialization=true")
                    .run(args)) {
                PlatformUatRootBootstrap owner = context.getBean(PlatformUatRootBootstrap.class);
                BootstrapReadback result = owner.bootstrapUatRootAdministrator(
                        input.administratorId(), LOGIN_NAME, DISPLAY_NAME, password, IDEMPOTENCY_KEY);
                if (!input.administratorId().equals(result.administratorId())
                        || !LOGIN_NAME.equals(result.loginName())
                        || !DISPLAY_NAME.equals(result.displayName())
                        || !"ENABLED".equals(result.status())
                        || !result.builtIn()
                        || !"PLATFORM_UAT_ROOT_BOOTSTRAPPED".equals(result.auditAction())) {
                    throw new IllegalStateException("UAT_PLATFORM_ROOT_BOOTSTRAP_READBACK_INVALID");
                }
                System.out.printf(
                        "UAT_PLATFORM_ROOT_BOOTSTRAP=PASS; ADMIN_ID=%s; STATUS=%s; BUILT_IN=%s; AUDIT=%s%n",
                        result.administratorId(), result.status(), result.builtIn(), result.auditAction());
                LOG.info(
                        "event=uat_platform_root_bootstrap outcome=SUCCEEDED administratorId={} status={} builtIn={} auditAction={}",
                        result.administratorId(),
                        result.status(),
                        result.builtIn(),
                        result.auditAction());
            }
        } catch (Exception failure) {
            LOG.error("event=uat_platform_root_bootstrap outcome=FAILED", failure);
            throw failure;
        } finally {
            Arrays.fill(password, '\0');
        }
    }

    record Input(UUID administratorId, char[] password) {
        static Input from(Map<String, String> environment) {
            if (!"uat".equals(environment.get("V2S_RUNTIME_ENVIRONMENT"))) {
                throw new IllegalArgumentException("UAT_RUNTIME_ENVIRONMENT_REQUIRED");
            }
            String databaseName = required(environment, "V2S_UAT_DATABASE_NAME");
            String databaseRole = required(environment, "V2S_UAT_DATABASE_ROLE");
            String jdbcUrl = required(environment, "CATERING_BUSINESS_DB_URL");
            if (!databaseName.matches("catering_v2s_uat_[a-z0-9_]+")
                    || !"catering_v2s_uat".equals(databaseRole)
                    || !jdbcUrl.startsWith("jdbc:postgresql://127.0.0.1:")
                    || !jdbcUrl.endsWith("/" + databaseName)) {
                throw new IllegalArgumentException("UAT_PLATFORM_BOOTSTRAP_DATABASE_TARGET_INVALID");
            }
            String idValue = required(environment, "V2S_UAT_PLATFORM_ROOT_ID");
            UUID id;
            try {
                id = UUID.fromString(idValue);
            } catch (IllegalArgumentException failure) {
                throw new IllegalArgumentException("UAT_PLATFORM_ROOT_ID_INVALID", failure);
            }
            if (!id.toString().equals(idValue)) {
                throw new IllegalArgumentException("UAT_PLATFORM_ROOT_ID_INVALID");
            }
            char[] password = required(environment, "V2S_UAT_PLATFORM_ROOT_PASSWORD").toCharArray();
            if (password.length < 8) throw new IllegalArgumentException("UAT_PLATFORM_ROOT_PASSWORD_INVALID");
            return new Input(id, password);
        }

        private static String required(Map<String, String> environment, String name) {
            String value = environment.get(name);
            if (value == null || value.isBlank()) throw new IllegalArgumentException(name + "_REQUIRED");
            return value;
        }
    }
}
