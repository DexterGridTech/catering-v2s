package com.catering.v2s.app.configuration;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.PlatformTransactionManager;

@Configuration
public class BusinessDataConfiguration {
    @Bean(initMethod = "migrate")
    public Flyway businessFlyway(DataSource dataSource) {
        return Flyway.configure()
            .dataSource(dataSource)
            .locations("classpath:db/migration")
            .defaultSchema("public")
            .load();
    }

    @Bean
    public JdbcTemplate businessJdbcTemplate(DataSource dataSource) {
        return new JdbcTemplate(dataSource);
    }

    @Bean
    public PlatformTransactionManager businessTransactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}
