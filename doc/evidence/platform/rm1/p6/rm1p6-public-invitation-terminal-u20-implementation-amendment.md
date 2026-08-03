# U20 public invitation terminal states

The owner view already exposes the invitation `status` and expiry. The public page must map `COMPLETED` to a success result and an expired non-completed view to an expiry result, both with a login return only. It must not offer consent, OTP, credentials, or completion commands from either terminal state. Pending/in-progress paths are unchanged.
