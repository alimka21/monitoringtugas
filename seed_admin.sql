-- Script untuk membuat akun Admin di Supabase Auth
DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'admin@tugas.com';
    user_password TEXT := 'tugas99';
BEGIN
    -- 1. Insert ke tabel auth.users
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, email_confirmed_at, 
        created_at, updated_at, role, aud, confirmation_token
    ) VALUES (
        new_user_id, 
        '00000000-0000-0000-0000-000000000000', 
        user_email, 
        crypt(user_password, gen_salt('bf')), 
        now(), 
        now(), 
        now(), 
        'authenticated', 
        'authenticated', 
        ''
    );

    -- 2. Insert ke tabel auth.identities (memperbaiki error provider_id)
    INSERT INTO auth.identities (
        id, user_id, identity_data, provider, provider_id, 
        created_at, updated_at, last_sign_in_at
    ) VALUES (
        gen_random_uuid(), 
        new_user_id, 
        jsonb_build_object('sub', new_user_id::text, 'email', user_email), 
        'email', 
        user_email, -- Kolom ini yang sebelumnya menyebabkan error (provider_id tidak boleh null)
        now(), 
        now(), 
        now()
    );
END $$;
