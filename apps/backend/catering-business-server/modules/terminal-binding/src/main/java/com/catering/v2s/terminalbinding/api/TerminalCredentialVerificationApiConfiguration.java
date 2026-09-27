package com.catering.v2s.terminalbinding.api;

import com.catering.v2s.terminalbinding.application.TerminalCredentialVerificationService;
import com.catering.v2s.terminalbinding.persistence.TerminalBindingOwnerPersistence;
import org.springframework.context.annotation.Import;

/** Explicit assembly entry point for the narrow credential-verification API consumed by TDS. */
@Import({TerminalCredentialVerificationService.class, TerminalBindingOwnerPersistence.class})
public final class TerminalCredentialVerificationApiConfiguration {}
