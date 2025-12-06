/**
 * Email template generator for order notifications
 */

interface OrderData {
  orderNumber: string;
  customerName: string;
  items: Array<{
    productTitle: string;
    variant: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingAddress: {
    fullName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  trackingUrl?: string;
  awbNumber?: string;
}

/**
 * Generate HTML email for order confirmed
 */
export function generateOrderConfirmedEmail(data: OrderData): { subject: string; html: string } {
  const subject = `Order Confirmed #${data.orderNumber} - Skinly`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; }
    .order-number { background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; font-weight: 600; }
    .items { margin: 20px 0; }
    .item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .totals { margin: 20px 0; border-top: 2px solid #eee; padding-top: 15px; }
    .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
    .total-row.final { font-weight: bold; font-size: 18px; color: #667eea; padding-top: 10px; border-top: 2px solid #667eea; margin-top: 10px; }
    .address { background: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✓ Order Confirmed!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Thank you for your order, ${data.customerName}</p>
    </div>
    
    <div class="content">
      <div class="order-number">
        Order Number: ${data.orderNumber}
      </div>
      
      <p>Your order has been confirmed and will be processed soon. We'll notify you when it ships!</p>
      
      <h3>Order Items:</h3>
      <div class="items">
        ${data.items.map(item => `
          <div class="item">
            <div>
              <strong>${item.productTitle}</strong><br>
              <span style="color: #666; font-size: 14px;">${item.variant} × ${item.quantity}</span>
            </div>
            <div style="font-weight: 600;">₹${(item.price * item.quantity).toFixed(2)}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>₹${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Shipping:</span>
          <span>${data.shippingFee === 0 ? 'FREE' : '₹' + data.shippingFee.toFixed(2)}</span>
        </div>
        <div class="total-row final">
          <span>Total:</span>
          <span>₹${data.total.toFixed(2)}</span>
        </div>
      </div>
      
      <h3>Shipping Address:</h3>
      <div class="address">
        <strong>${data.shippingAddress.fullName}</strong><br>
        ${data.shippingAddress.addressLine1}<br>
        ${data.shippingAddress.addressLine2 ? data.shippingAddress.addressLine2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.state} - ${data.shippingAddress.pincode}
      </div>
      
      <center>
        <a href="https://skinly.onhercules.app/orders" class="button">Track Your Order</a>
      </center>
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at support@skinly.com</p>
      <p style="margin: 5px 0 0;">© 2025 Skinly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

/**
 * Generate HTML email for order dispatched
 */
export function generateOrderDispatchedEmail(data: OrderData): { subject: string; html: string } {
  const subject = `Your Order is On The Way! #${data.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; }
    .tracking-box { background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center; }
    .awb { font-size: 24px; font-weight: bold; color: #10b981; margin: 10px 0; }
    .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📦 Your Order is On The Way!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Order #${data.orderNumber}</p>
    </div>
    
    <div class="content">
      <p>Great news, ${data.customerName}! Your order has been dispatched and is on its way to you.</p>
      
      ${data.awbNumber ? `
        <div class="tracking-box">
          <p style="margin: 0 0 10px; font-weight: 600;">Tracking Number:</p>
          <div class="awb">${data.awbNumber}</div>
          ${data.trackingUrl ? `
            <a href="${data.trackingUrl}" class="button" style="margin-top: 15px;">Track Your Order</a>
          ` : ''}
        </div>
      ` : ''}
      
      <h3>Shipping To:</h3>
      <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
        <strong>${data.shippingAddress.fullName}</strong><br>
        ${data.shippingAddress.addressLine1}<br>
        ${data.shippingAddress.addressLine2 ? data.shippingAddress.addressLine2 + '<br>' : ''}
        ${data.shippingAddress.city}, ${data.shippingAddress.state} - ${data.shippingAddress.pincode}
      </div>
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at support@skinly.com</p>
      <p style="margin: 5px 0 0;">© 2025 Skinly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

/**
 * Generate HTML email for order delivered
 */
export function generateOrderDeliveredEmail(data: OrderData): { subject: string; html: string } {
  const subject = `Order Delivered! #${data.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Order Delivered!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Order #${data.orderNumber}</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.customerName},</p>
      <p>Your order has been successfully delivered! We hope you love your new products.</p>
      
      <center>
        <a href="https://skinly.onhercules.app/orders" class="button">View Order</a>
      </center>
      
      <p style="margin-top: 30px;">We'd love to hear your feedback! Please take a moment to review your purchase.</p>
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at support@skinly.com</p>
      <p style="margin: 5px 0 0;">© 2025 Skinly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

/**
 * Generate HTML email for order cancelled
 */
export function generateOrderCancelledEmail(data: OrderData): { subject: string; html: string } {
  const subject = `Order Cancelled - #${data.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order Cancelled</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Order #${data.orderNumber}</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.customerName},</p>
      <p>Your order has been cancelled. If you didn't request this cancellation, please contact us immediately.</p>
      
      <p>If this was your decision, you can always place a new order when you're ready!</p>
      
      <center>
        <a href="https://skinly.onhercules.app/products" class="button">Browse Products</a>
      </center>
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at support@skinly.com</p>
      <p style="margin: 5px 0 0;">© 2025 Skinly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}

/**
 * Generate HTML email for payment failed
 */
export function generatePaymentFailedEmail(data: OrderData): { subject: string; html: string } {
  const subject = `Payment Failed - Order #${data.orderNumber}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
    .container { max-width: 600px; margin: 20px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .content { padding: 30px 20px; }
    .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 14px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠ Payment Failed</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Order #${data.orderNumber}</p>
    </div>
    
    <div class="content">
      <p>Hi ${data.customerName},</p>
      <p>Unfortunately, your payment for order #${data.orderNumber} could not be processed.</p>
      
      <p><strong>What to do next:</strong></p>
      <ul>
        <li>Check if you have sufficient funds in your account</li>
        <li>Try using a different payment method</li>
        <li>Contact your bank if the issue persists</li>
      </ul>
      
      <center>
        <a href="https://skinly.onhercules.app/orders/${data.orderNumber}" class="button">Retry Payment</a>
      </center>
    </div>
    
    <div class="footer">
      <p>Questions? Contact us at support@skinly.com</p>
      <p style="margin: 5px 0 0;">© 2025 Skinly. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
  
  return { subject, html };
}
