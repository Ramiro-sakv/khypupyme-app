GRANT USAGE ON SCHEMA khypupyme TO :"app_name";

GRANT SELECT, INSERT, UPDATE, DELETE ON
    khypupyme."AspNetUsers", khypupyme."AspNetUserClaims",
    khypupyme."AspNetUserLogins", khypupyme."AspNetUserTokens",
    khypupyme.email_challenges,
    khypupyme."OpenIddictApplications", khypupyme."OpenIddictAuthorizations",
    khypupyme."OpenIddictScopes", khypupyme."OpenIddictTokens"
TO :"app_name";

GRANT USAGE, SELECT ON SEQUENCE khypupyme."AspNetUserClaims_Id_seq" TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.businesses TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.business_settings, khypupyme.account_selections TO :"app_name";

GRANT SELECT, INSERT, UPDATE ON khypupyme.products, khypupyme.customers, khypupyme.cash_sessions, khypupyme.receivables TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.commerce_entries, khypupyme.commerce_lines, khypupyme.commerce_receipts TO :"app_name";
