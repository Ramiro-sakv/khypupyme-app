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

GRANT SELECT, INSERT, UPDATE ON khypupyme.business_code_counters TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.products, khypupyme.customers, khypupyme.cash_sessions, khypupyme.receivables TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.commerce_entries, khypupyme.commerce_lines, khypupyme.commerce_receipts TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.timber_stock, khypupyme.timber_practices TO :"app_name";
GRANT DELETE ON khypupyme.businesses TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.retail_lots, khypupyme.equipment_units TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.equipment_movements TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.container_types, khypupyme.container_balances TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.container_movements TO :"app_name";
GRANT SELECT, INSERT, DELETE ON khypupyme.part_references, khypupyme.product_fitments TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.furniture_deliveries TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.work_items TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.account_trials, khypupyme.demo_payments TO :"app_name";
GRANT SELECT, INSERT, UPDATE ON khypupyme.security_proofs, khypupyme.security_mail_limits, khypupyme.business_deletions TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.commerce_audit, khypupyme.account_closures TO :"app_name";
GRANT UPDATE ("AcknowledgedAt") ON khypupyme.commerce_receipts TO :"app_name";
GRANT SELECT, INSERT ON khypupyme.pilot_key_ring TO :"app_name";
