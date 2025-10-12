import CryptoJS from 'crypto-js';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

exports.handler = async (event, context) => {
    console.log("auth.js: event.body:", event.body);

    const headers = {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400",
    };

    if (event.httpMethod === "OPTIONS") {
        console.log("auth.js: Handling OPTIONS request");
        return {
            statusCode: 200,
            headers: headers,
            body: "",
        };
    }

    try {
        console.log("auth.js: Function started");

        let requestBody;
        if (event.body) {
            try {
                requestBody = JSON.parse(event.body);
                console.log("auth.js: Request body:", requestBody);
            } catch (parseError) {
                console.error("auth.js: Error parsing JSON:", parseError);
                return {
                    statusCode: 400,
                    headers: headers,
                    body: JSON.stringify({ isValid: false, error: "Invalid JSON format in request body" }),
                };
            }
        } else {
            console.warn("auth.js: Request body is empty");
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "Request body is empty" }),
            };
        }

        const initData = requestBody.initData;
        let referralCode = null;

        // Extract start_param from initData
        const urlParams = new URLSearchParams(initData);
        const startParam = urlParams.get('start_param');

        if (startParam) {
            try {
                referralCode = startParam.replace('ref_', '');
                console.log("auth.js: referralCode from start_param: " + referralCode);
            } catch (error) {
                console.error("auth.js: Error processing start_param: " + error);
            }
        }

        if (!initData) {
            console.warn("auth.js: initData is missing in request body");
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "initData is missing in request body" }),
            };
        }

        console.log("auth.js: initData:", initData);

        const searchParams = new URLSearchParams(initData);
        const userStr = searchParams.get('user');
        const authDate = searchParams.get('auth_date');
        const hash = searchParams.get('hash');

        if (!userStr || !authDate || !hash) {
            console.warn("auth.js: Missing user, auth_date, or hash in initData");
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "Missing user, auth_date, or hash in initData" }),
            };
        }

        let user;
        try {
            user = JSON.parse(userStr);
            console.log("auth.js: Parsed user data:", user);
        } catch (error) {
            console.error("auth.js: Error parsing user JSON:", error);
            return {
                statusCode: 400,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "Error parsing user JSON" }),
            };
        }

        const userId = user.id;
        const firstName = user.first_name;
        const lastName = user.last_name || "";
        const username = user.username;
        const avatarUrl = user.photo_url || null;

        console.log("auth.js: Extracted user data - userId:", userId, "firstName:", firstName, "lastName:", lastName, "username:", username, "avatarUrl:", avatarUrl);

        if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error("auth.js: Environment variables not defined");
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "Environment variables not defined" }),
            };
        }

        const params = new URLSearchParams(initData);
        params.sort();

        let dataCheckString = "";
        for (const [key, value] of params.entries()) {
            if (key !== "hash") {
                dataCheckString += `${key}=${value}\n`;
            }
        }
        dataCheckString = dataCheckString.trim();

        const secretKey = CryptoJS.HmacSHA256(BOT_TOKEN, "WebAppData").toString(CryptoJS.enc.Hex);
        const calculatedHash = CryptoJS.HmacSHA256(dataCheckString, CryptoJS.enc.Hex.parse(secretKey)).toString(CryptoJS.enc.Hex);

        if (calculatedHash !== hash) {
            console.warn("auth.js: Hash mismatch - Calculated hash:", calculatedHash, "Provided hash:", hash);
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "Hash mismatch" }),
            };
        }

        const date = parseInt(authDate);
        const now = Math.floor(Date.now() / 1000);

        if (now - date > 86400) {
            console.warn("auth.js: auth_date is too old");
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({ isValid: false }),
            };
        }

        let userDB;
        try {
            console.log("auth.js: Trying to find user in tonjacket with telegram_user_id:", userId);
            const { data: existingUser, error: selectError } = await supabase
                .from('tonjacket')
                .select('*')
                .eq('telegram_user_id', userId)
                .single();

            if (selectError) {
                console.error("auth.js: Error finding user in tonjacket:", selectError);
                if (selectError.code === 'PGRST116') {
                    console.log("auth.js: User not found, creating new user in tonjacket");
                    
                    // Create invite link
                    const inviteLink = `https://t.me/TONJacketBot?startapp=ref_${userId}`;
                    
                    // Create user in tonjacket table
                    const tonjacketUserObject = {
                        first_name: firstName,
                        last_name: lastName,
                        username: username,
                        avatar: avatarUrl,
                        telegram_user_id: userId,
                        wallet: "no wallet",
                        invited_friends: 0,
                        coins: 500.000,
                        coins_for_invite: 0.000,
                        bet_amount: 0.000,
                        ton_amount: 0.000,
                        invite_link: inviteLink
                    };

                    console.log("auth.js: Creating user in tonjacket table:", tonjacketUserObject);
                    const { data: newUser, error: insertError } = await supabase
                        .from('tonjacket')
                        .insert([tonjacketUserObject])
                        .select('*')
                        .single();

                    if (insertError) {
                        console.error("auth.js: Error creating user in tonjacket table:", insertError);
                        return {
                            statusCode: 500,
                            headers: headers,
                            body: JSON.stringify({ isValid: false, error: "Failed to create user in tonjacket table" }),
                        };
                    }

                    console.log("auth.js: User successfully created in tonjacket table:", newUser);
                    userDB = newUser;

                    // Handle referral system
                    if (referralCode) {
                        console.log("auth.js: Referral code found (from start_param):", referralCode);

                        const { data: referrer, error: referrerSelectError } = await supabase
                            .from('tonjacket')
                            .select('*')
                            .eq('telegram_user_id', referralCode)
                            .single();

                        if (referrerSelectError) {
                            console.error("auth.js: Error finding referrer in tonjacket:", referrerSelectError, "Referral Code:", referralCode);
                        }
                        
                        if (referrer) {
                            console.log("auth.js: Referrer found:", referrer);
                            
                            // Update referrer in tonjacket table
                            const newCoinsForInvite = parseFloat(((referrer.coins_for_invite || 0) + 50).toFixed(3));
                            const newCoins = parseFloat(((referrer.coins || 0) + 50).toFixed(3));
                            const newInvitedFriends = (referrer.invited_friends || 0) + 1;

                            const { data: updatedReferrer, error: updateReferrerError } = await supabase
                                .from('tonjacket')
                                .update({
                                    invited_friends: newInvitedFriends,
                                    coins_for_invite: newCoinsForInvite,
                                    coins: newCoins
                                })
                                .eq('telegram_user_id', referralCode)
                                .select('*')
                                .single();

                            if (updateReferrerError) {
                                console.error("auth.js: Error updating tonjacket for referrer:", updateReferrerError);
                            } else {
                                console.log("auth.js: Successfully updated tonjacket for referrer:", updatedReferrer);
                            }
                        } else {
                            console.error("auth.js: Referrer not found in tonjacket", "Referral Code:", referralCode);
                        }
                    }
                } else {
                    return {
                        statusCode: 500,
                        headers: headers,
                        body: JSON.stringify({ isValid: false, error: "Failed to find user in tonjacket table" }),
                    };
                }
            } else {
                console.log("auth.js: User found in tonjacket table:", existingUser);
                userDB = existingUser;
                
                // Update avatar if it's missing but we have a new one
                if (!userDB.avatar && avatarUrl) {
                    console.log("auth.js: Updating user avatar in tonjacket");
                    const { data: updatedUser, error: updateError } = await supabase
                        .from('tonjacket')
                        .update({ avatar: avatarUrl })
                        .eq('telegram_user_id', userId)
                        .select('*')
                        .single();

                    if (!updateError) {
                        console.log("auth.js: Avatar updated successfully in tonjacket");
                        userDB = updatedUser;
                    } else {
                        console.error("auth.js: Error updating avatar in tonjacket:", updateError);
                    }
                }
            }

            console.log("auth.js: Returning user data from tonjacket:", userDB);

            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    isValid: true, 
                    userData: userDB
                }),
            };

        } catch (dbError) {
            console.error("auth.js: Database error:", dbError);
            return {
                statusCode: 500,
                headers: headers,
                body: JSON.stringify({ isValid: false, error: "Database error: " + dbError.message }),
            };
        }

    } catch (error) {
        console.error("auth.js: Netlify Function error:", error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({ isValid: false, error: error.message }),
        };
    }
};