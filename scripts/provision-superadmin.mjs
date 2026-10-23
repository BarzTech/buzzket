import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SUPERADMIN_PASSWORD;
const expectedExistingUserId = process.env.SUPERADMIN_EXPECTED_USER_ID;
const email = "kneegher14@gmail.com";

if (!supabaseUrl || !serviceRoleKey || !password) {
  throw new Error("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPERADMIN_PASSWORD in the trusted server environment.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let existingUser = null;
for (let page = 1; ; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw error;
  existingUser = data.users.find((user) => user.email?.toLowerCase() === email);
  if (existingUser || data.users.length < 1000) break;
}

let user;
if (existingUser) {
  if (!expectedExistingUserId || expectedExistingUserId !== existingUser.id) {
    throw new Error("Account already exists. Verify its user ID in Supabase Auth, then set SUPERADMIN_EXPECTED_USER_ID before rerunning.");
  }
  const { data, error } = await supabase.auth.admin.updateUserById(existingUser.id, { password });
  if (error) throw error;
  user = data.user;
} else {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
}

const { error: roleError } = await supabase
  .from("user_roles")
  .upsert({ user_id: user.id, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
if (roleError) throw roleError;

console.log(`Superadmin role configured for ${email} (${user.id}). Password value was not displayed.`);
