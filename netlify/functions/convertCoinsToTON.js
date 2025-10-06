// netlify/functions/convertCoinsToTON.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

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
    const { userId, coinsAmount, tonAmount } = requestBody;

    if (!userId || coinsAmount === undefined || tonAmount === undefined) {
      console.error("convertCoinsToTON.js: Missing required parameters");
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "Missing required parameters" }),
      };
    }

    // Get current user data
    const { data: user, error: userError } = await supabase
      .from('tonjacket')
      .select('coins, ton_amount')
      .eq('telegram_user_id', userId)
      .single();

    if (userError) {
      console.error("convertCoinsToTON.js: Error fetching user data:", userError);
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "Failed to fetch user data" }),
      };
    }

    // Check if user has enough coins
    if (user.coins < coinsAmount) {
      return {
        statusCode: 400,
        headers: headers,
        body: JSON.stringify({ error: "Insufficient coins" }),
      };
    }

    // Calculate new balances
    const newCoins = parseFloat((user.coins - coinsAmount).toFixed(3));
    const newTonAmount = parseFloat((user.ton_amount + tonAmount).toFixed(6));

    // Update user data
    const { data, error } = await supabase
      .from('tonjacket')
      .update({ 
        coins: newCoins,
        ton_amount: newTonAmount
      })
      .eq('telegram_user_id', userId)
      .select('*')
      .single();

    if (error) {
      console.error("convertCoinsToTON.js: Error updating balances in Supabase:", error);
      return {
        statusCode: 500,
        headers: headers,
        body: JSON.stringify({ error: "Failed to update balances in Supabase" }),
      };
    }

    console.log("convertCoinsToTON.js: Successfully converted coins to TON:", data);

    return {
      statusCode: 200,
      headers: headers,
      body: JSON.stringify({ 
        message: "Conversion successful", 
        data: data 
      }),
    };

  } catch (error) {
    console.error("convertCoinsToTON.js: Error:", error);
    return {
      statusCode: 500,
      headers: headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};