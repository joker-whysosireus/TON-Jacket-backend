import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  try {
    // Добавляем логирование для отладки
    console.log("Received event body:", event.body);
    
    const body = JSON.parse(event.body);
    console.log("Parsed body:", body);

    // Поддерживаем оба варианта параметров для обратной совместимости
    const taskId = body.taskId || body.id;
    const rewardAmount = body.rewardAmount || body.amount;
    const telegramUserId = body.telegramUserId || body.telegram_user_id;

    console.log("Extracted parameters:", { taskId, rewardAmount, telegramUserId });

    if (!taskId || !rewardAmount || !telegramUserId) {
      console.error("Missing required parameters");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: "Missing required parameters",
          received: body 
        })
      };
    }

    // Get current user data
    const { data: user, error: userError } = await supabase
      .from('tonjacket')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single();

    if (userError) {
      console.error("User not found:", userError);
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "User not found: " + userError.message })
      };
    }

    console.log("Found user:", user);

    // Update user data - увеличиваем coins
    const newCoins = parseFloat((user.coins + rewardAmount).toFixed(3));

    console.log("Updating coins:", { oldCoins: user.coins, rewardAmount, newCoins });

    const { data: updatedUser, error: updateError } = await supabase
      .from('tonjacket')
      .update({
        coins: newCoins
      })
      .eq('telegram_user_id', telegramUserId)
      .select('*')
      .single();

    if (updateError) {
      console.error("Update error:", updateError);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to update user data: " + updateError.message })
      };
    }

    console.log("User updated successfully:", updatedUser);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        userData: updatedUser,
        message: "Reward claimed successfully"
      })
    };

  } catch (error) {
    console.error("Internal server error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error: " + error.message })
    };
  }
};