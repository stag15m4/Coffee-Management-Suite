-- Staging S003: fictional cafes and passwordless database-test identities only.
DO $seed$
DECLARE ta uuid; tb uuid; ua uuid:=gen_random_uuid(); ub uuid:=gen_random_uuid(); ue uuid:=gen_random_uuid();
BEGIN
INSERT INTO public.tenants(name,slug) VALUES('TEST ONLY - Cedar Cafe','staging-cedar') RETURNING id INTO ta;
INSERT INTO public.tenants(name,slug) VALUES('TEST ONLY - Harbor Cafe','staging-harbor') RETURNING id INTO tb;
INSERT INTO auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
VALUES(ua,'authenticated','authenticated','manager.cedar@example.invalid',NULL,NULL,'{}','{}'),
(ub,'authenticated','authenticated','manager.harbor@example.invalid',NULL,NULL,'{}','{}'),
(ue,'authenticated','authenticated','employee.cedar@example.invalid',NULL,NULL,'{}','{}');
INSERT INTO public.user_profiles(id,tenant_id,email,full_name,role)
VALUES(ua,ta,'manager.cedar@example.invalid','TEST Cedar Manager','manager'),
(ub,tb,'manager.harbor@example.invalid','TEST Harbor Manager','manager'),
(ue,ta,'employee.cedar@example.invalid','TEST Cedar Employee','employee');
INSERT INTO public.tenant_branding(tenant_id,company_name) VALUES(ta,'TEST ONLY - Cedar Cafe'),(tb,'TEST ONLY - Harbor Cafe');
INSERT INTO public.tip_employees(tenant_id,name) VALUES(ta,'TEST Cedar Barista'),(tb,'TEST Harbor Barista');
INSERT INTO public.audit_logs(tenant_id,actor_id,action,resource_type) VALUES(ta,ua,'staging.fixture.created','staging_test'),(tb,ub,'staging.fixture.created','staging_test');
END $seed$;