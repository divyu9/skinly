I have identified the issue causing the "Something went wrong" error on the Product Edit page.

**The Problem:**
The `useQuery` and `useMutation` hooks are used extensively in `src/pages/admin/products/edit/page.tsx` to fetch data and update records, but they are **not imported** at the top of the file. This causes the `ReferenceError: useQuery is not defined`.

**The Plan:**
1.  **Fix Imports**: I will update `src/pages/admin/products/edit/page.tsx` to correctly import `useQuery` and `useMutation` from `"convex/react"`.
2.  **Deploy**: I will commit and push this fix to the `prod-ready` branch.

This is a straightforward fix that will resolve the crash immediately.