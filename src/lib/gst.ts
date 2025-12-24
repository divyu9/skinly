/**
 * GST Calculation Utilities (Frontend)
 * 
 * Indian GST for Skinly (Uttar Pradesh based company)
 * - All products have 18% GST included in displayed price
 * - Intra-state (UP): 9% CGST + 9% SGST
 * - Inter-state (other): 18% IGST
 */

export interface GSTBreakdown {
  taxableAmount: number;
  gstRate: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalGstAmount: number;
  isUttarPradesh: boolean;
}

/**
 * Calculate GST breakdown from tax-inclusive amount
 * @param inclusiveAmount - Amount including GST (as displayed on website)
 * @param state - Customer's state
 * @returns GST breakdown
 */
export function calculateGST(inclusiveAmount: number, state: string): GSTBreakdown {
  const GST_RATE = 0.18; // 18%
  const normalizedState = state.trim().toLowerCase();
  
  // Check if order is from Uttar Pradesh (intra-state)
  const isUttarPradesh = 
    normalizedState === "uttar pradesh" || 
    normalizedState === "up" ||
    normalizedState === "uttarpradesh";
  
  // Calculate taxable amount (price before GST)
  // Formula: Taxable Amount = Inclusive Amount / (1 + GST Rate)
  const taxableAmount = inclusiveAmount / (1 + GST_RATE);
  
  // Calculate total GST amount
  const totalGstAmount = inclusiveAmount - taxableAmount;
  
  if (isUttarPradesh) {
    // Intra-state: Split into CGST and SGST
    const cgstRate = 0.09; // 9%
    const sgstRate = 0.09; // 9%
    const cgstAmount = totalGstAmount / 2; // Half of total GST
    const sgstAmount = totalGstAmount / 2; // Half of total GST
    
    return {
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      gstRate: GST_RATE,
      cgstRate,
      sgstRate,
      cgstAmount: Math.round(cgstAmount * 100) / 100,
      sgstAmount: Math.round(sgstAmount * 100) / 100,
      totalGstAmount: Math.round(totalGstAmount * 100) / 100,
      isUttarPradesh: true,
    };
  } else {
    // Inter-state: IGST only
    const igstRate = 0.18; // 18%
    const igstAmount = totalGstAmount;
    
    return {
      taxableAmount: Math.round(taxableAmount * 100) / 100,
      gstRate: GST_RATE,
      igstRate,
      igstAmount: Math.round(igstAmount * 100) / 100,
      totalGstAmount: Math.round(totalGstAmount * 100) / 100,
      isUttarPradesh: false,
    };
  }
}
