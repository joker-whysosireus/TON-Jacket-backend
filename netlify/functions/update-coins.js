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

        const { telegramUserId, coinsToAdd = 50 } = requestBody;

        if (!telegramUserId) {
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Missing telegramUserId" }),
            };
        }

        // Получаем текущее значение coins
        const { data: user, error: selectError } = await supabase
            .from('tonjacket')
            .select('coins')
            .eq('telegram_user_id', telegramUserId)
            .single();

        if (selectError) {
            console.error('Error fetching current coins:', selectError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Error fetching current coins: " + selectError.message }),
            };
        }

        const currentCoins = parseFloat(user.coins) || 0;
        const newCoins = parseFloat((currentCoins + coinsToAdd).toFixed(3));

        // Обновляем coins
        const { error: updateError } = await supabase
            .from('tonjacket')
            .update({ 
                coins: newCoins
            })
            .eq('telegram_user_id', telegramUserId);

        if (updateError) {
            console.error('Error updating coins:', updateError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Error updating coins: " + updateError.message }),
            };
        }

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({ 
                success: true, 
                newCoins: newCoins 
            }),
        };

    } catch (error) {
        console.error("update-coins.js: Netlify Function error:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};