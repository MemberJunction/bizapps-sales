export const environment = {
    GRAPHQL_URI: 'http://localhost:4141/',
    GRAPHQL_WS_URI: 'ws://localhost:4141/',
    // INERT, and corrected to this app's port anyway so it stops misleading readers. Neither auth
    // provider reads this value: MJ's MSAL and Auth0 providers both set their redirect from
    // `window.location.origin` (see ng-auth-services/dist/lib/providers/mjexplorer-*-provider.
    // service.js), which resolves to 4341 automatically. It arrived as 4200 by inheritance from the
    // sibling repo's copy of this file. What DOES matter is that http://localhost:4341 is registered
    // as an allowed callback/redirect URI on the IdP side.
    REDIRECT_URI: 'http://localhost:4341/',
    CLIENT_ID: '7e6e6ecf-66ff-4733-9c60-1e6def949897',
    TENANT_ID: 'ff10ade7-5d03-40a9-be28-cb7ab99670b1',
    CLIENT_AUTHORITY: 'https://login.microsoftonline.com/ff10ade7-5d03-40a9-be28-cb7ab99670b1',
    // Auth0 rather than MSAL: the MSAL flow cannot be driven headlessly, so
    // browser-based end-to-end runs authenticate against the Auth0 automation
    // tenant. Domain and client id below are the public SPA values for it.
    AUTH_TYPE: 'auth0',
    NODE_ENV: 'development',
    AUTOSAVE_DEBOUNCE_MS: 1200,
    SEARCH_DEBOUNCE_MS: 800,
    MIN_SEARCH_LENGTH: 3,
    MJ_CORE_SCHEMA_NAME: 'admin',
    production: false,
    APPLICATION_NAME: 'MemberJunction Explorer',
    APPLICATION_INSTANCE: 'DEV',
    AUTH0_DOMAIN: 'bluecypress-dev.us.auth0.com',
    AUTH0_CLIENTID: 'uRNpH3B0sFKVc2yrfBGBalfiUphUK5JI',
  } as const;