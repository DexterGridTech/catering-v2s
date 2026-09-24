package com.catering.v2s.storeterminal.application;

/** Produces a candidate only; uniqueness is established by the owner database constraint. */
@FunctionalInterface
public interface ActivationCodeCandidateSource {
    String nextCandidate();
}
