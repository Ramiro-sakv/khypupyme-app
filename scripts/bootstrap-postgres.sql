\getenv owner_password KHYPU_BOOTSTRAP_OWNER_PASSWORD
\getenv app_password KHYPU_BOOTSTRAP_APP_PASSWORD

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'owner_name', :'owner_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'owner_name')
\gexec

SELECT format('CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD %L', :'app_name', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'app_name')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I ENCODING %L TEMPLATE template0', :'database_name', :'owner_name', 'UTF8')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'database_name')
\gexec

SELECT EXISTS (
    SELECT FROM pg_database
    WHERE datname = :'database_name' AND datdba = (SELECT oid FROM pg_roles WHERE rolname = :'owner_name')
) AS owner_matches
\gset
\if :owner_matches
    REVOKE ALL ON DATABASE :"database_name" FROM PUBLIC;
    GRANT CONNECT ON DATABASE :"database_name" TO :"app_name";
\else
    DO $$ BEGIN RAISE EXCEPTION 'La base existente tiene un propietario distinto'; END $$;
\endif
