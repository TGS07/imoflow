-- CREATE FUNCTION concede EXECUTE a PUBLIC por omissão; como todos os roles
-- (incluindo anon) são implicitamente membros de PUBLIC, o revoke anterior
-- feito só a "anon" não bastou — anon continuava a herdar EXECUTE via
-- PUBLIC. Este revoke fecha essa via.
revoke execute on function public.merge_people(uuid, uuid) from public;
