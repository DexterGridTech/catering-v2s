package com.catering.v2s.app.acceptance;

import java.lang.reflect.Method;

record ScenarioDefinition(Object target, Method method, AcceptanceScenario annotation) {}
