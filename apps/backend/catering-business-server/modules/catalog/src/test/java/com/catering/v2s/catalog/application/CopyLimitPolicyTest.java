package com.catering.v2s.catalog.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CopyLimitPolicyTest {
    @Test
    void loadsTheSingleRuntimeDeclarationPoint() {
        CopyLimitPolicy policy = CopyLimitPolicy.load(new ObjectMapper());
        assertEquals(true, policy.selectedItemCount() > 0);
        assertEquals(true, policy.closureItemCount() >= policy.selectedItemCount());
        assertEquals(Set.of("TAG", "SALES_UNIT", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE"), policy.dictionaryKinds());
        assertEquals(true, policy.allowsDictionaryKind("SALES_UNIT"));
        assertEquals(false, policy.allowsDictionaryKind("SPEC"));
    }
}
