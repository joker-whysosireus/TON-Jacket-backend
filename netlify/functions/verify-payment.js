// netlify/functions/verify-payment.js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const itemConfigs = {
    // Бустеры
    ton_boost: {
        item_id: "ton_boost",
        title: "TON Booster",
        description: "Increase power by 0.072 BTS/hr",
        price: 100,
        currency: "XTR",
        dbColumn: "ton_boost",
        isBooster: true
    },
    apps_boost: {
        item_id: "apps_boost",
        title: "Apps Booster",
        description: "Increase power by 18.472 BTS/hr",
        price: 300,
        currency: "XTR",
        dbColumn: "apps_boost",
        isBooster: true
    },
    prem_boost: {
        item_id: "prem_boost",
        title: "Prem Booster",
        description: "Increase power by 38.172 BTS/hr",
        price: 500,
        currency: "XTR",
        dbColumn: "prem_boost",
        isBooster: true
    },
    eth_boost: {
        item_id: "eth_boost",
        title: "DOGS Boost",
        description: "Increase power by 48.472 BTS/hr",
        price: 1000,
        currency: "XTR",
        dbColumn: "eth_boost",
        isBooster: true
    },
    btc_boost: {
        item_id: "btc_boost",
        title: "NOT Boost",
        description: "Increase power by 68.172 BTS/hr",
        price: 1300,
        currency: "XTR",
        dbColumn: "btc_boost",
        isBooster: true
    },
    sol_boost: {
        item_id: "sol_boost",
        title: "PEPE Booster",
        description: "Increase power by 35.472 BTS/hr",
        price: 600,
        currency: "XTR",
        dbColumn: "sol_boost",
        isBooster: true
    },
    near_boost: {
        item_id: "near_boost",
        title: "MAJOR Booster",
        description: "Increase power by 42.172 BTS/hr",
        price: 800,
        currency: "XTR",
        dbColumn: "near_boost",
        isBooster: true
    },
    
    // Апгрейды
    up_storage: {
        item_id: "up_storage",
        title: "Upgrade Storage",
        description: "Increase storage capacity to 5000",
        price: 149,
        currency: "XTR",
        dbColumn: "up_storage",
        isBooster: true,
        isUpgrade: true
    },
    up_boosters: {
        item_id: "up_boosters",
        title: "Double Boosters Power",
        description: "Double the power of all active boosters",
        price: 149,
        currency: "XTR",
        dbColumn: "up_boosters",
        isBooster: true,
        isUpgrade: true
    },
    
    // NFT
    flower_nft: {
        item_id: "flower_nft",
        title: "Flower NFT",
        description: "Beautiful flower for your digital garden",
        price: 5,
        currency: "XTR",
        dbColumn: "flower_nft_purchased",
        isNft: true
    },
    cactus_nft: {
        item_id: "cactus_nft",
        title: "Cactus NFT",
        description: "Hardy desert companion that requires little maintenance",
        price: 15,
        currency: "XTR",
        dbColumn: "cactus_nft_purchased",
        isNft: true
    },
    palm_nft: {
        item_id: "palm_nft",
        title: "Palm NFT",
        description: "Tropical palm tree that brings vacation vibes",
        price: 25,
        currency: "XTR",
        dbColumn: "palm_nft_purchased",
        isNft: true
    },
    spruce_nft: {
        item_id: "spruce_nft",
        title: "Spruce NFT",
        description: "Evergreen tree that stays green all year round",
        price: 50,
        currency: "XTR",
        dbColumn: "spruce_nft_purchased",
        isNft: true
    }
};

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        };
    }

    if (!supabaseUrl || !supabaseAnonKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: "Supabase credentials not configured" 
            }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { payload, user_id } = body;

        if (!payload || !user_id) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: "Missing payload or user_id" 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        let payloadData;
        try {
            payloadData = JSON.parse(payload);
        } catch (error) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: "Invalid payload format" 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        const { item_id } = payloadData;
        
        const itemConfig = itemConfigs[item_id];
        if (!itemConfig) {
            return {
                statusCode: 400,
                body: JSON.stringify({ 
                    success: false, 
                    error: "Unknown item_id" 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        const isNft = itemConfig.isNft || false;
        const isBooster = itemConfig.isBooster || false;
        const isUpgrade = itemConfig.isUpgrade || false;

        // Для NFT: проверка доступности (макс. 1000)
        let nftSoldOut = false;
        let currentGlobalCount = 0;
        
        if (isNft) {
            const { data: nftCountData, error: countError } = await supabase
                .from('nft_global_counts')
                .select('count')
                .eq('item_id', item_id)
                .single();

            if (countError) {
                console.error("NFT count error:", countError.message);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        success: false, 
                        error: "Failed to check NFT availability" 
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                };
            }

            currentGlobalCount = nftCountData?.count || 0;
            
            if (currentGlobalCount >= 1000) {
                nftSoldOut = true;
                return {
                    statusCode: 200,
                    body: JSON.stringify({ 
                        success: true, 
                        soldOut: true 
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                };
            }
        }

        // Получаем данные пользователя
        const { data: fullUserData, error: fullSelectError } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_user_id', user_id)
            .single();

        if (fullSelectError || !fullUserData) {
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    success: false, 
                    error: "Failed to fetch user data" 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        // Проверка дубликата платежа
        const existingPayments = fullUserData.payments || [];
        const isDuplicate = existingPayments.some(p => p.payload === payload);

        if (isDuplicate) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    duplicate: true 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        // Для бустеров: проверка, куплен ли уже бустер (кроме апгрейдов)
        if (isBooster && !isUpgrade && fullUserData[itemConfig.dbColumn]) {
            return {
                statusCode: 200,
                body: JSON.stringify({ 
                    success: true, 
                    alreadyOwned: true 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        // Подготовка данных для обновления
        const newPayment = { 
            payload: payload, 
            item_id: item_id,
            timestamp: new Date().toISOString()
        };
        
        const updateData = {
            payments: [...existingPayments, newPayment]
        };

        // Для NFT увеличиваем счетчик пользователя
        if (isNft) {
            const currentCount = fullUserData[itemConfig.dbColumn] || 0;
            updateData[itemConfig.dbColumn] = currentCount + 1;
        }

        // Для бустеров устанавливаем флаг (кроме апгрейдов)
        if (isBooster && !isUpgrade) {
            updateData[itemConfig.dbColumn] = true;
        }

        // Для апгрейдов устанавливаем флаг
        if (isBooster && isUpgrade) {
            updateData[itemConfig.dbColumn] = true;
        }

        // Для NFT увеличиваем глобальный счетчик
        if (isNft && !nftSoldOut) {
            try {
                // Используем UPSERT для надежного обновления
                const { error: updateCountError } = await supabase
                    .from('nft_global_counts')
                    .upsert(
                        { 
                            item_id: item_id, 
                            count: currentGlobalCount + 1 
                        },
                        { onConflict: 'item_id' }
                    );

                if (updateCountError) {
                    console.error("NFT count update error:", updateCountError.message);
                    throw new Error("Failed to update global NFT count");
                }
                
                console.log(`NFT ${item_id} count updated to ${currentGlobalCount + 1}`);
            } catch (error) {
                console.error("Global NFT count update failed:", error.message);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ 
                        success: false, 
                        error: "Failed to update NFT global count: " + error.message 
                    }),
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                };
            }
        }

        // Обновление пользователя
        const { error: updateError } = await supabase
            .from('users')
            .update(updateData)
            .eq('telegram_user_id', user_id);

        if (updateError) {
            console.error("User update error:", updateError.message);
            
            // Откатываем глобальный счетчик NFT при ошибке
            if (isNft && !nftSoldOut) {
                try {
                    await supabase
                        .from('nft_global_counts')
                        .upsert(
                            { 
                                item_id: item_id, 
                                count: currentGlobalCount 
                            },
                            { onConflict: 'item_id' }
                        );
                    console.log(`Rolled back NFT ${item_id} count to ${currentGlobalCount}`);
                } catch (rollbackError) {
                    console.error("NFT rollback failed:", rollbackError.message);
                }
            }
            
            return {
                statusCode: 500,
                body: JSON.stringify({ 
                    success: false, 
                    error: "Failed to update user data: " + updateError.message 
                }),
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            };
        }

        // Успешное завершение
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true,
                message: "Payment processed successfully",
                nftCount: isNft ? currentGlobalCount + 1 : null,
                userCount: isNft ? (fullUserData[itemConfig.dbColumn] || 0) + 1 : null
            }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        };

    } catch (error) {
        console.error("Unhandled error in verify-payment:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: "Internal server error: " + error.message 
            }),
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
            },
        };
    }
};