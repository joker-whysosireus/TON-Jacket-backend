import CryptoJS from 'crypto-js';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
    console.log("claim-ad-reward.js: event.body:", event.body);

    const headers = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    };

    if (event.httpMethod === "OPTIONS") {
        console.log("claim-ad-reward.js: Handling OPTIONS request");
        return {
            statusCode: 200,
            headers: headers,
            body: "",
        };
    }

    try {
        console.log("claim-ad-reward.js: Function started");

        let requestBody;
        if (event.body) {
            try {
                requestBody = JSON.parse(event.body);
                console.log("claim-ad-reward.js: Request body:", requestBody);
            } catch (parseError) {
                console.error("claim-ad-reward.js: Error parsing JSON:", parseError);
                return {
                    statusCode: 400,
                    headers: headers,
                    body: JSON.stringify({ success: false, error: "Invalid JSON format in request body" }),
                };
            }
        } else {
            console.warn("claim-ad-reward.js: Request body is empty");
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Request body is empty" }),
            };
        }

        const { telegram_user_id } = requestBody;

        if (!telegram_user_id) {
            console.warn("claim-ad-reward.js: telegram_user_id is missing in request body");
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ success: false, error: "telegram_user_id is missing in request body" }),
            };
        }

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error("claim-ad-reward.js: Environment variables not defined");
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Environment variables not defined" }),
            };
        }

        // Проверяем существование пользователя
        const { data: existingUser, error: selectError } = await supabase
            .from('tonjacket')
            .select('*')
            .eq('telegram_user_id', telegram_user_id)
            .single();

        if (selectError) {
            console.error("claim-ad-reward.js: Error finding user in tonjacket:", selectError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Failed to find user in tonjacket table" }),
            };
        }

        console.log("claim-ad-reward.js: User found in tonjacket table:", existingUser);

        // Обновляем coins пользователя (увеличиваем на 75)
        const newCoins = parseFloat((existingUser.coins + 75).toFixed(3));
        
        const { data: updatedUser, error: updateError } = await supabase
            .from('tonjacket')
            .update({ 
                coins: newCoins
            })
            .eq('telegram_user_id', telegram_user_id)
            .select('*')
            .single();

        if (updateError) {
            console.error("claim-ad-reward.js: Error updating user in tonjacket:", updateError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ success: false, error: "Failed to update user in tonjacket table" }),
            };
        }

        console.log("claim-ad-reward.js: User successfully updated in tonjacket table:", updatedUser);

        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({
                success: true, 
                userData: updatedUser
            }),
        };

    } catch (error) {
        console.error("claim-ad-reward.js: Netlify Function error:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ success: false, error: error.message }),
        };
    }
};