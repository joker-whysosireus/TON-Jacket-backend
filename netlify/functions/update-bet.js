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
        let requestBody;
        if (event.body) {
            requestBody = JSON.parse(event.body);
        } else {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Request body is empty" }),
            };
        }

        const { telegramUserId, betAmount } = requestBody;

        if (!telegramUserId || betAmount === undefined) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Missing telegramUserId or betAmount" }),
            };
        }

        // Получаем текущее значение bet_amount
        const { data: user, error: selectError } = await supabase
            .from('tonjacket')
            .select('bet_amount')
            .eq('telegram_user_id', telegramUserId)
            .single();

        if (selectError) {
            console.error('Error fetching current bet amount:', selectError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Error fetching current bet amount: " + selectError.message }),
            };
        }

        const currentBetAmount = parseFloat(user.bet_amount) || 0;
        const newBetAmount = parseFloat((currentBetAmount + betAmount).toFixed(3));

        // Обновляем bet_amount без updated_at
        const { data, error: updateError } = await supabase
            .from('tonjacket')
            .update({ 
                bet_amount: newBetAmount
            })
            .eq('telegram_user_id', telegramUserId)
            .select();

        if (updateError) {
            console.error('Error updating bet amount:', updateError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Error updating bet amount: " + updateError.message }),
            };
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ 
                success: true, 
                newBetAmount: newBetAmount 
            }),
        };

    } catch (error) {
        console.error("update-bet.js: Netlify Function error:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};