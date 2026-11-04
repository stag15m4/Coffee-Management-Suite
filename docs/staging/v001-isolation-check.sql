-- Staging verification V001: role/tenant tests; all attempted writes rolled back.
BEGIN;
DO $test$
DECLARE a uuid; b uuid; e uuid; ta uuid; tb uuid; n integer; r record;
BEGIN
SELECT id,tenant_id INTO a,ta FROM public.user_profiles WHERE email='manager.cedar@example.invalid';
SELECT id,tenant_id INTO b,tb FROM public.user_profiles WHERE email='manager.harbor@example.invalid';
SELECT id INTO e FROM public.user_profiles WHERE email='employee.cedar@example.invalid';
IF a IS NULL OR b IS NULL OR e IS NULL THEN RAISE EXCEPTION 'missing fixtures'; END IF;
FOR r IN SELECT a AS uid,ta AS tenant UNION ALL SELECT b,tb LOOP
PERFORM set_config('request.jwt.claim.sub',r.uid::text,true);
PERFORM set_config('request.jwt.claims',json_build_object('sub',r.uid,'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT count(*) INTO n FROM public.audit_logs;
IF n<>1 THEN RAISE EXCEPTION 'manager audit isolation failed: %',n; END IF;
IF EXISTS(SELECT 1 FROM public.audit_logs WHERE tenant_id<>r.tenant) THEN RAISE EXCEPTION 'foreign audit visible'; END IF;
SELECT count(*) INTO n FROM public.tip_employees;
IF n<>1 THEN RAISE EXCEPTION 'tip roster isolation failed: %',n; END IF;
BEGIN
INSERT INTO public.audit_logs(tenant_id,actor_id,action,resource_type) VALUES(r.tenant,r.uid,'forged','test');
RAISE EXCEPTION 'audit insert unexpectedly allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
BEGIN
UPDATE public.audit_logs SET action='tampered';
RAISE EXCEPTION 'audit update unexpectedly allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
BEGIN
DELETE FROM public.audit_logs;
RAISE EXCEPTION 'audit delete unexpectedly allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
RESET ROLE;
END LOOP;
PERFORM set_config('request.jwt.claim.sub',e::text,true);
PERFORM set_config('request.jwt.claims',json_build_object('sub',e,'role','authenticated')::text,true);
SET LOCAL ROLE authenticated;
SELECT count(*) INTO n FROM public.audit_logs;
IF n<>0 THEN RAISE EXCEPTION 'employee audit visibility failed'; END IF;
RESET ROLE;
SET LOCAL ROLE anon;
BEGIN
PERFORM 1 FROM public.audit_logs;
RAISE EXCEPTION 'anonymous audit read allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
RESET ROLE;
SET LOCAL ROLE service_role;
INSERT INTO public.audit_logs(tenant_id,actor_id,action,resource_type) VALUES(ta,a,'staging.test.write','staging_test');
BEGIN
DELETE FROM public.audit_logs;
RAISE EXCEPTION 'service audit delete allowed';
EXCEPTION WHEN insufficient_privilege THEN NULL; END;
RESET ROLE;
IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity) THEN RAISE EXCEPTION 'RLS missing'; END IF;
IF has_table_privilege('authenticated','public.audit_logs','TRUNCATE') OR has_table_privilege('service_role','public.audit_logs','TRUNCATE') THEN RAISE EXCEPTION 'audit truncate allowed'; END IF;
END $test$;
SELECT 'PASS: manager isolation, roster isolation, employee/anon restrictions, audit write controls, RLS' AS result;
ROLLBACK;