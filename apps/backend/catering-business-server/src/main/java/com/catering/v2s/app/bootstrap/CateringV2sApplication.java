package com.catering.v2s.app.bootstrap;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

@SpringBootApplication
@ComponentScan("com.catering.v2s")
public class CateringV2sApplication {
    public static void main(String[] args) {
        SpringApplication.run(CateringV2sApplication.class, args);
    }
}
