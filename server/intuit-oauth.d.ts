declare module 'intuit-oauth' {
  interface OAuthClientConfig {
    clientId: string;
    clientSecret: string;
    environment: 'sandbox' | 'production';
    redirectUri: string;
  }

  interface AuthorizeUriOptions {
    scope: string[];
    state?: string;
  }

  interface TokenResponse {
    getJson(): {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      realmId?: string;
    };
  }

  class OAuthClient {
    static scopes: {
      Accounting: string;
      Payment: string;
      Payroll: string;
      TimeTracking: string;
      Benefits: string;
      Profile: string;
      Email: string;
      Phone: string;
      Address: string;
      OpenId: string;
    };

    constructor(config: OAuthClientConfig);
    authorizeUri(options: AuthorizeUriOptions): string;
    createToken(url: string): Promise<TokenResponse>;
    refresh(): Promise<TokenResponse>;
    revoke(params: { token: string }): Promise<any>;
    setToken(token: { access_token: string; refresh_token: string; token_type: string; expires_in: number }): void;
  }

  export = OAuthClient;
}
