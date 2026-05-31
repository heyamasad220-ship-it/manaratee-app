# Manaratee Login Page Updates & Google OAuth Setup

## Logo Improvements

### Goals

* Make the Manaratee logo significantly larger on the login page.
* Remove the small footer menu links:

  * Privacy
  * Terms
  * Help
* Keep the layout clean and centered.

### AuthLayout Replacement

Updated `AuthLayout.tsx` to:

* Increase logo size on desktop.
* Use the full logo on mobile instead of the placeholder "M / Your Organization" branding.
* Remove footer links entirely.
* Maintain responsive behavior.

---

## Social Login Buttons

### Objective

Add working:

* Continue with Google
* Continue with Apple

buttons using Supabase OAuth.

### Requirements

At the top of the component:

```tsx
"use client"
```

Import:

```tsx
import { createClient } from "@/lib/supabase/client"
```

Create handlers:

```tsx
const signInWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}

const signInWithApple = async () => {
  await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  })
}
```

---

# Supabase Google OAuth Setup

## Current Status

Using:

* Next.js
* Supabase Authentication
* Multi-tenant SaaS application

---

## Step 1: Open Google Cloud

Navigate to:

https://console.cloud.google.com

Create a project if needed.

Example project name:

```text
Manaratee
```

---

## Step 2: Google Cloud Onboarding

Selected:

* Host a website
* Develop APIs

Ignored:

* Kubernetes
* Containers
* Virtual Machines
* CI/CD
* Mobile Apps

---

## Step 3: Configure OAuth Consent Screen

Navigate:

```text
Google Cloud
→ APIs & Services
→ OAuth Consent Screen
```

Settings:

```text
User Type: External
App Name: Manaratee
User Support Email: Your Email
Developer Contact Email: Your Email
```

Save all steps.

No verification required during development.

---

## Step 4: Create OAuth Credentials

Navigate:

```text
Google Cloud
→ APIs & Services
→ Credentials
→ Create Credentials
→ OAuth Client ID
```

Choose:

```text
Application Type: Web Application
Name: Manaratee Web
```

---

## Step 5: Add Redirect URI

Authorized Redirect URI:

```text
https://ykixrgzainmelcitejlu.supabase.co/auth/v1/callback
```

Create the credential.

---

## Step 6: Copy Credentials

Google will generate:

```text
Client ID
Client Secret
```

Copy both values.

---

## Step 7: Configure Supabase

Navigate:

```text
Supabase Dashboard
→ Authentication
→ Providers
→ Google
```

Enable Google.

Paste:

```text
Client ID
Client Secret
```

Save.

---

## Step 8: Configure Site URL

Navigate:

```text
Supabase Dashboard
→ Authentication
→ URL Configuration
```

Set:

```text
http://localhost:3000
```

Save.

---

## Apple OAuth

Apple OAuth has not been configured.

Requirements:

* Apple Developer Account ($99/year)
* Apple Service ID
* Apple Private Key
* Apple Domain Verification

Recommendation:

Complete Google OAuth first before enabling Apple Sign In.

---

## Next Steps

1. Finish Google OAuth credential creation.
2. Paste Client ID and Secret into Supabase.
3. Save Google Provider settings.
4. Run application:

```bash
npm run dev
```

5. Test "Continue with Google".
6. Confirm successful login and callback handling.
