export default {
  providers: [
    {
      // PROD Clerk (for production and staging)
      domain: "https://clerk.goskinly.com",
      applicationID: "convex",
    },
    {
      // DEV Clerk (for localhost)
      domain: "https://relative-alpaca-77.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
