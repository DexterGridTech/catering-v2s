# R3 edge templates

These files are templates for the externally controlled access provider and the private business app route. They do not provide an identity, account, session, seed, or default workspace.

The provider must supply `R3_EXTERNAL_ACCESS_PROVIDER` and return a short-lived signed `X-Edge-Auth` value. The application remains fail-closed until the U03 edge adapter is implemented.
