import { query } from "./_generated/server";
import { ConvexError } from "convex/values";

/**
 * Comprehensive health check for WhatsApp messaging system
 * Checks all use cases, templates, provider config, and queue status
 */
export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    // Check authentication
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError({
        message: "User not logged in",
        code: "UNAUTHENTICATED",
      });
    }

    // Get all use cases
    const usecases = await ctx.db.query("whUsecaseTemplates").collect();
    
    // Get all templates
    const templates = await ctx.db.query("whApprovedTemplates").collect();
    
    // Get recent messages for success rate calculation (last 7 days)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentMessages = await ctx.db
      .query("whatsappMessages")
      .filter((q) => q.gte(q.field("createdAt"), sevenDaysAgo))
      .collect();
    
    // Get queue status
    const queuePending = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    
    const queueProcessing = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .collect();
    
    const queueFailed = await ctx.db
      .query("whatsappQueue")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    // Check provider status (based on whatsapp module - AuthKey provider)
    // Provider config is managed through environment variables and admin UI
    const hasRecentMessages = recentMessages.length > 0;
    const providerStatus = {
      configured: hasRecentMessages, // If messages exist, provider is likely configured
      active: true, // Assume active if configured
      provider: "AuthKey",
      hasCredentials: hasRecentMessages,
    };

    // Calculate overall stats
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const messages24h = recentMessages.filter((m) => m.createdAt >= last24h);
    const sentMessages = messages24h.filter((m) => m.status === "sent" || m.status === "delivered");
    const successRate = messages24h.length > 0 
      ? Math.round((sentMessages.length / messages24h.length) * 100) 
      : 0;

    // Check each use case
    const usecaseHealth = usecases.map((usecase) => {
      const issues: string[] = [];
      let status: "healthy" | "warning" | "error" | "disabled" = "healthy";

      // Check if disabled
      if (!usecase.enabled) {
        status = "disabled";
      } else {
        // Check if template is assigned
        if (!usecase.providerTemplateId || !usecase.templateName) {
          issues.push("No template assigned");
          status = "error";
        } else {
          // Check if template exists and is active
          const template = templates.find(
            (t) => t.providerTemplateId === usecase.providerTemplateId
          );
          
          if (!template) {
            issues.push("Template not found");
            status = "error";
          } else if (template.status !== "active") {
            issues.push(`Template status: ${template.status}`);
            status = "warning";
          }
        }

        // Calculate success rate for this use case
        const usecaseMessages = recentMessages.filter(
          (m) => m.usecaseKey === usecase.usecaseKey
        );
        const usecaseSent = usecaseMessages.filter(
          (m) => m.status === "sent" || m.status === "delivered"
        );
        const usecaseSuccessRate = usecaseMessages.length > 0
          ? Math.round((usecaseSent.length / usecaseMessages.length) * 100)
          : null;

        // Check if messages are failing
        if (usecaseMessages.length > 0 && usecaseSuccessRate !== null && usecaseSuccessRate < 50) {
          issues.push(`Low success rate: ${usecaseSuccessRate}%`);
          if (status === "healthy") status = "warning";
        }

        // Get last sent time
        const lastMessage = usecaseMessages.sort((a, b) => b.createdAt - a.createdAt)[0];
        
        return {
          usecaseKey: usecase.usecaseKey,
          displayName: usecase.displayName,
          enabled: usecase.enabled,
          isTransactional: usecase.isTransactional,
          templateName: usecase.templateName,
          providerTemplateId: usecase.providerTemplateId,
          status,
          issues,
          messageCount: usecaseMessages.length,
          successRate: usecaseSuccessRate,
          lastSent: lastMessage?.createdAt,
        };
      }

      return {
        usecaseKey: usecase.usecaseKey,
        displayName: usecase.displayName,
        enabled: usecase.enabled,
        isTransactional: usecase.isTransactional,
        templateName: usecase.templateName,
        providerTemplateId: usecase.providerTemplateId,
        status,
        issues,
        messageCount: 0,
        successRate: null,
        lastSent: null,
      };
    });

    // Determine overall system status
    const hasErrors = usecaseHealth.some((u) => u.status === "error" && u.enabled);
    const hasWarnings = usecaseHealth.some((u) => u.status === "warning");
    const overallStatus = !providerStatus.configured || !providerStatus.active
      ? "error"
      : hasErrors
      ? "error"
      : hasWarnings
      ? "warning"
      : "healthy";

    // Count stuck messages (processing for more than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const stuckMessages = queueProcessing.filter(
      (q) => (q.lastAttemptAt ?? q.scheduledFor) < fiveMinutesAgo
    );

    return {
      overallStatus,
      provider: providerStatus,
      queue: {
        pending: queuePending.length,
        processing: queueProcessing.length,
        failed: queueFailed.length,
        stuck: stuckMessages.length,
      },
      stats: {
        messages24h: messages24h.length,
        successRate,
        totalUsecases: usecases.length,
        enabledUsecases: usecases.filter((u) => u.enabled).length,
        healthyUsecases: usecaseHealth.filter((u) => u.status === "healthy").length,
      },
      usecases: usecaseHealth,
    };
  },
});
