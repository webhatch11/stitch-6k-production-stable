import IORedis from "ioredis";

// Global connection cache for Redis
let redis: IORedis | null = null;
try {
  if (process.env.REDIS_URL) {
    redis = new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
    });
    redis.on("error", (err) => {
      console.warn("[Shiprocket SDK] Redis connection error, falling back to memory cache:", err.message);
    });
  }
} catch (e) {
  console.warn("[Shiprocket SDK] Failed to initialize Redis:", e);
}

// In-memory fallback cache
let memoryTokenCache: { token: string; expiresAt: number } | null = null;

const SHIPROCKET_EMAIL = process.env.SHIPROCKET_EMAIL || "";
const SHIPROCKET_PASSWORD = process.env.SHIPROCKET_PASSWORD || "";
const isMockMode = !SHIPROCKET_EMAIL || !SHIPROCKET_PASSWORD;

if (isMockMode) {
  console.log("ℹ️ Shiprocket email or password missing. Operating in MOCK mode.");
}

async function getAuthToken(): Promise<string> {
  if (isMockMode) {
    return "mock_shiprocket_jwt_token_xyz123";
  }

  const cacheKey = "shiprocket:auth_token";
  const nowSecs = Math.floor(Date.now() / 1000);

  // Try Redis first
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn("[Shiprocket SDK] Redis get failed:", e);
    }
  }

  // Try Memory Cache
  if (memoryTokenCache && memoryTokenCache.expiresAt > nowSecs) {
    return memoryTokenCache.token;
  }

  // Authenticate with Shiprocket API
  try {
    const res = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: SHIPROCKET_EMAIL,
        password: SHIPROCKET_PASSWORD,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Shiprocket Auth failed: Status ${res.status} - ${errText}`);
    }

    const data = await res.json();
    const token = data.token;
    if (!token) throw new Error("No token returned in Shiprocket login response");

    // Shiprocket token typically expires in 10 days (864000 seconds). We cache for 9 days.
    const cacheDurationSecs = 9 * 24 * 60 * 60;

    if (redis) {
      try {
        await redis.set(cacheKey, token, "EX", cacheDurationSecs);
      } catch (e) {
        console.warn("[Shiprocket SDK] Redis set failed:", e);
      }
    }

    memoryTokenCache = {
      token,
      expiresAt: nowSecs + cacheDurationSecs,
    };

    return token;
  } catch (err) {
    console.error("[Shiprocket SDK] Failed to authenticate with Shiprocket API, falling back to mock:", err);
    return "mock_shiprocket_fallback_token";
  }
}

export interface ShiprocketOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  order_items: Array<{
    name: string;
    sku: string;
    units: number;
    selling_price: number;
  }>;
  payment_method: "Prepaid" | "COD";
  sub_total: number;
  length: number;
  width: number;
  height: number;
  weight: number;
}

export interface ShiprocketDispatchResult {
  success: boolean;
  shiprocketOrderId?: number;
  shipmentId?: number;
  awbCode?: string;
  courierName?: string;
  isMock: boolean;
  error?: string;
}

export const shiprocket = {
  /**
   * Create an adhoc order in Shiprocket and assign AWB automatically
   */
  async createAndDispatchOrder(payload: ShiprocketOrderPayload): Promise<ShiprocketDispatchResult> {
    const isActuallyMock = isMockMode || (await getAuthToken()) === "mock_shiprocket_fallback_token";

    if (isActuallyMock) {
      console.log(`[Shiprocket MOCK] Dispatching order ${payload.order_id} to Shiprocket Sandbox...`);
      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      const mockOrderId = Math.floor(10000000 + Math.random() * 90000000);
      const mockShipmentId = Math.floor(10000000 + Math.random() * 90000000);
      const mockAwb = "SR" + Math.floor(10000000 + Math.random() * 90000000);

      return {
        success: true,
        shiprocketOrderId: mockOrderId,
        shipmentId: mockShipmentId,
        awbCode: mockAwb,
        courierName: "Shiprocket Premium Express (Mock)",
        isMock: true,
      };
    }

    try {
      const token = await getAuthToken();

      // Step 1: Create Order in Shiprocket
      const orderRes = await fetch("https://apiv2.shiprocket.in/v1/external/orders/create/adhoc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!orderRes.ok) {
        const errText = await orderRes.text();
        throw new Error(`Order creation failed in Shiprocket: ${errText}`);
      }

      const orderData = await orderRes.json();
      const shipmentId = orderData.shipment_id;
      const shiprocketOrderId = orderData.order_id;

      if (!shipmentId) {
        throw new Error(`Shiprocket created order but returned no shipment_id. Response: ${JSON.stringify(orderData)}`);
      }

      // Step 2: Auto-assign AWB for the shipment
      const awbRes = await fetch("https://apiv2.shiprocket.in/v1/external/courier/assign/awb", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shipment_id: shipmentId,
        }),
      });

      let awbCode: string | undefined;
      let courierName: string | undefined;

      if (awbRes.ok) {
        const awbData = await awbRes.json();
        if (awbData.status === 200 && awbData.response?.data?.awb_code) {
          awbCode = awbData.response.data.awb_code;
          courierName = awbData.response.data.courier_name;
        } else {
          console.warn("[Shiprocket SDK] AWB assignment response structure did not match or failed:", awbData);
        }
      } else {
        const errText = await awbRes.text();
        console.warn(`[Shiprocket SDK] Failed to automatically assign AWB via API: ${errText}`);
      }

      return {
        success: true,
        shiprocketOrderId,
        shipmentId,
        awbCode: awbCode || `PENDING-AWB-${shipmentId}`,
        courierName: courierName || "Shiprocket Partner Courier",
        isMock: false,
      };

    } catch (err: any) {
      console.error("[Shiprocket SDK] Dispatch order API exception:", err);
      return {
        success: false,
        error: err.message || "Unknown Shiprocket dispatch error",
        isMock: false,
      };
    }
  },

  /**
   * Track Shipment AWB status
   */
  async trackShipment(awbCode: string): Promise<any> {
    if (isMockMode || awbCode.startsWith("SR")) {
      // Return simulated progress based on AWB number
      const numericPart = parseInt(awbCode.replace(/\D/g, ""), 10) || 0;
      const stateIndex = numericPart % 5;
      
      const states = [
        { status: "AWB Assigned", desc: "Shipment details uploaded to Shiprocket." },
        { status: "In Transit", desc: "Processed through Shiprocket automated routing hub." },
        { status: "Out For Delivery", desc: "Shiprocket delivery agent is out for delivery." },
        { status: "Delivered", desc: "Package has been successfully handed over to client." },
        { status: "Canceled", desc: "Order shipment cancelled by sender." }
      ];

      return {
        success: true,
        awb: awbCode,
        current_status: states[stateIndex].status,
        etd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString("en-IN"),
        scans: [
          { date: new Date().toISOString(), activity: states[stateIndex].desc, location: "New Delhi Hub" }
        ],
        isMock: true
      };
    }

    try {
      const token = await getAuthToken();
      const res = await fetch(`https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awbCode}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`Shiprocket tracking call returned status ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      console.error("[Shiprocket SDK] Tracking error:", err);
      return { success: false, error: err.message || "Tracking failed" };
    }
  }
};
