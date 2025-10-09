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
    const { taskId, rewardAmount, telegramUserId } = JSON.parse(event.body);

    if (!taskId || !rewardAmount || !telegramUserId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required parameters" })
      };
    }

    // Get current user data
    const { data: user, error: userError } = await supabase
      .from('tonjacket')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single();

    if (userError) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "User not found" })
      };
    }

    // Check if task is already claimed
    const claimedTasks = user.claimed_tasks || [];
    if (claimedTasks.includes(taskId)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Task already claimed" })
      };
    }

    // Update user data
    const newCoins = parseFloat((user.coins + rewardAmount).toFixed(3));
    const newClaimedTasks = [...claimedTasks, taskId];

    const { data: updatedUser, error: updateError } = await supabase
      .from('tonjacket')
      .update({
        coins: newCoins,
        claimed_tasks: newClaimedTasks
      })
      .eq('telegram_user_id', telegramUserId)
      .select('*')
      .single();

    if (updateError) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Failed to update user data" })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ userData: updatedUser })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal server error" })
    };
  }
};