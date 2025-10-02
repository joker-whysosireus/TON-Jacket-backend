// netlify/functions/updateWallet.js
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: headers,
      body: "",
    };
  }

  try {
    const requestBody = JSON.parse(event.body);
    const { userId, walletAddress } = requestBody;

    if (!userId || !walletAddress) {
      console.error("updateWallet.js: Missing userId or walletAddress");
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "Missing userId or walletAddress" }),
      };
    }

    const { data, error } = await supabase
      .from('users')
      .update({ wallet: walletAddress })
      .eq('telegram_user_id', userId)
      .select('*')
      .single();

    if (error) {
      console.error("updateWallet.js: Error updating wallet in Supabase:", error);
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "Failed to update wallet in Supabase" }),
      };
    }

    console.log("updateWallet.js: Successfully updated wallet in Supabase:", data);

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ message: "Wallet updated successfully", data: data }),
    };

  } catch (error) {
    console.error("updateWallet.js: Error:", error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};