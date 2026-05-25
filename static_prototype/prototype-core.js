/**
 * 6K Shirts Prototype Core Logic
 * Handles Registry (Mock DB), Cart, Animations, and Admin Intelligence
 */

const RegistryManager = {
    PRODUCTS_KEY: 'registry_products',
    ORDERS_KEY: 'registry_orders',
    COUPONS_KEY: 'registry_coupons',
    VERSION_KEY: 'registry_version',
    WALLET_BALANCE_KEY: 'registry_wallet_balance',
    WALLET_TX_KEY: 'registry_wallet_transactions',
    LOYALTY_POINTS_KEY: 'registry_loyalty_points',
    LOYALTY_TX_KEY: 'registry_loyalty_transactions',
    CURRENT_VERSION: '2.0_refund_split', // Bump version for loyalty & wallet modules

    init() {
        const savedVersion = localStorage.getItem(this.VERSION_KEY);
        if (savedVersion !== this.CURRENT_VERSION) {
            localStorage.removeItem(this.PRODUCTS_KEY);
            localStorage.removeItem(this.ORDERS_KEY);
            localStorage.removeItem(this.COUPONS_KEY);
            localStorage.removeItem(this.WALLET_BALANCE_KEY);
            localStorage.removeItem(this.WALLET_TX_KEY);
            localStorage.removeItem(this.LOYALTY_POINTS_KEY);
            localStorage.removeItem(this.LOYALTY_TX_KEY);
            localStorage.setItem(this.VERSION_KEY, this.CURRENT_VERSION);
        }

        if (!localStorage.getItem(this.PRODUCTS_KEY)) {
            const seedProducts = [
                {
                    id: 'seed-1',
                    title: 'Classic White Oxford',
                    price: 1299,
                    category: 'Cotton',
                    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&q=80&w=800',
                    isNew: true
                },
                {
                    id: 'seed-2',
                    title: 'Midnight Blue Poplin',
                    price: 1450,
                    category: 'Cotton',
                    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&q=80&w=800',
                    isNew: true
                },
                {
                    id: 'seed-3',
                    title: 'Sage Green Heritage',
                    price: 1699,
                    category: 'Linen',
                    image: 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?auto=format&fit=crop&q=80&w=800',
                    isNew: true
                },
                {
                    id: 'seed-4',
                    title: 'Charcoal Linen Series',
                    price: 1850,
                    category: 'Linen',
                    image: 'https://images.unsplash.com/photo-1610652396593-60526715f3ac?auto=format&fit=crop&q=80&w=800',
                    isNew: false
                },
                {
                    id: 'seed-5',
                    title: 'Burnt Ochre Twill',
                    price: 1550,
                    category: 'Cotton',
                    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&q=80&w=800',
                    isNew: false
                },
                {
                    id: 'seed-6',
                    title: 'Indigo Denim Shirt',
                    price: 1999,
                    category: 'Denim',
                    image: 'https://images.unsplash.com/photo-1516826957135-700dedea698c?auto=format&fit=crop&q=80&w=800',
                    isNew: true,
                    stock: 25
                }
            ];
            localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(seedProducts));
        }

        if (!localStorage.getItem(this.ORDERS_KEY)) {
            const seedOrders = [
                {
                    id: 'ORD-101',
                    customer: 'Aditya Singhania',
                    date: new Date().toLocaleDateString(),
                    total: 6400,
                    status: 'Delivered', // Eligible for returns
                    items: ['Classic White Oxford'],
                    originalTotal: 6400,
                    couponDiscount: 0,
                    couponCode: '',
                    walletPaid: 0,
                    gatewayPaid: 6400,
                    pointsRedeemed: 0,
                    pointsDiscount: 0,
                    pointsEarned: 640
                }
            ];
            localStorage.setItem(this.ORDERS_KEY, JSON.stringify(seedOrders));
        }

        if (!localStorage.getItem(this.COUPONS_KEY)) {
            const seedCoupons = [
                { id: 'CPN-1', code: 'HERITAGE10', discount: 10, type: 'percent', active: true },
                { id: 'CPN-2', code: 'LAUNCH500', discount: 500, type: 'flat', active: true }
            ];
            localStorage.setItem(this.COUPONS_KEY, JSON.stringify(seedCoupons));
        }

        if (localStorage.getItem(this.WALLET_BALANCE_KEY) === null) {
            localStorage.setItem(this.WALLET_BALANCE_KEY, '2500');
            const welcomeWalletTx = [
                { id: 'WTX-101', date: new Date().toLocaleDateString(), amount: 2500, type: 'credit', description: 'Welcome Sign Up Bonus' }
            ];
            localStorage.setItem(this.WALLET_TX_KEY, JSON.stringify(welcomeWalletTx));
        }

        if (localStorage.getItem(this.LOYALTY_POINTS_KEY) === null) {
            localStorage.setItem(this.LOYALTY_POINTS_KEY, '500');
            const welcomeLoyaltyTx = [
                { id: 'LTX-101', date: new Date().toLocaleDateString(), points: 500, type: 'credit', description: 'Account Registration Points' }
            ];
            localStorage.setItem(this.LOYALTY_TX_KEY, JSON.stringify(welcomeLoyaltyTx));
        }
    },

    getProducts() {
        return JSON.parse(localStorage.getItem(this.PRODUCTS_KEY) || '[]');
    },

    saveProduct(product) {
        const products = this.getProducts();
        // Support both single image (legacy) and multiple images
        const images = product.images || [product.image];
        products.unshift({
            ...product, 
            id: product.id || 'ART-' + Date.now(), 
            isNew: true,
            images: images,
            image: images[0], // Fallback for legacy components
            stock: product.stock || 0
        });
        localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
    },

    getOrders() {
        return JSON.parse(localStorage.getItem(this.ORDERS_KEY) || '[]');
    },

    saveOrder(order) {
        const orders = this.getOrders();
        const newOrder = {
            id: order.id || ('ORD-' + Math.floor(Math.random() * 9000 + 1000)),
            ...order
        };
        orders.unshift(newOrder);
        localStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));
        localStorage.setItem('cartCount', '0'); // Clear cart after order
        localStorage.removeItem('cart_items'); // Clear cart items array
        return newOrder;
    },

    getCoupons() {
        return JSON.parse(localStorage.getItem(this.COUPONS_KEY) || '[]');
    },

    saveCoupon(coupon) {
        const coupons = this.getCoupons();
        coupons.unshift({ ...coupon, id: 'CPN-' + Date.now(), active: true });
        localStorage.setItem(this.COUPONS_KEY, JSON.stringify(coupons));
    },

    deleteCoupon(id) {
        const coupons = this.getCoupons().filter(c => c.id !== id);
        localStorage.setItem(this.COUPONS_KEY, JSON.stringify(coupons));
        showToast("Coupon removed");
    },

    validateCoupon(code) {
        const coupons = this.getCoupons();
        return coupons.find(c => c.code.toUpperCase() === code.toUpperCase() && c.active);
    },

    getDashboardMetrics() {
        const orders = this.getOrders();
        const activeOrders = orders.filter(o => o.status !== 'Returned');
        const products = this.getProducts();
        const revenue = activeOrders.reduce((sum, o) => sum + o.total, 0);
        
        // In a real DB, you'd sum the wallet balance of ALL users. 
        // For this prototype, we get the global wallet balance.
        const walletLiability = this.getWalletBalance();

        return {
            totalOrders: activeOrders.length,
            totalRevenue: revenue,
            inventoryCount: products.length,
            walletLiability: walletLiability,
            conversion: '4.2%'
        };
    },

    deleteProduct(id) {
        const products = this.getProducts().filter(p => p.id !== id);
        localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
        showToast("Item removed");
    },

    getWalletBalance() {
        return parseFloat(localStorage.getItem(this.WALLET_BALANCE_KEY) || '0');
    },

    getWalletTransactions() {
        return JSON.parse(localStorage.getItem(this.WALLET_TX_KEY) || '[]');
    },

    getWalletData() {
        return {
            balance: this.getWalletBalance(),
            transactions: this.getWalletTransactions()
        };
    },

    applyWalletDebit(amount, orderId) {
        let balance = this.getWalletBalance();
        balance -= amount;
        localStorage.setItem(this.WALLET_BALANCE_KEY, balance.toString());

        const txs = this.getWalletTransactions();
        txs.unshift({
            id: 'WTX-' + Date.now(),
            date: new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
            amount: amount,
            type: 'debit',
            description: `Payment for Order #${orderId}`
        });
        localStorage.setItem(this.WALLET_TX_KEY, JSON.stringify(txs));
    },

    applyWalletCredit(amount, description, orderId) {
        let balance = this.getWalletBalance();
        balance += amount;
        localStorage.setItem(this.WALLET_BALANCE_KEY, balance.toString());

        const txs = this.getWalletTransactions();
        txs.unshift({
            id: 'WTX-' + Date.now(),
            date: new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
            amount: amount,
            type: 'credit',
            description: description || `Refund for Order #${orderId}`
        });
        localStorage.setItem(this.WALLET_TX_KEY, JSON.stringify(txs));
    },

    getLoyaltyPoints() {
        return parseInt(localStorage.getItem(this.LOYALTY_POINTS_KEY) || '0');
    },

    getLoyaltyTransactions() {
        return JSON.parse(localStorage.getItem(this.LOYALTY_TX_KEY) || '[]');
    },

    getLoyaltyData() {
        return {
            points: this.getLoyaltyPoints(),
            transactions: this.getLoyaltyTransactions()
        };
    },

    applyLoyaltyDebit(points, orderId) {
        let balance = this.getLoyaltyPoints();
        balance = Math.max(0, balance - points);
        localStorage.setItem(this.LOYALTY_POINTS_KEY, balance.toString());

        const txs = this.getLoyaltyTransactions();
        txs.unshift({
            id: 'LTX-' + Date.now(),
            date: new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
            points: points,
            type: 'debit',
            description: `Redeemed on Order #${orderId}`
        });
        localStorage.setItem(this.LOYALTY_TX_KEY, JSON.stringify(txs));
    },

    awardLoyaltyPoints(total, orderId) {
        const points = Math.floor(total / 10);
        if (points <= 0) return;
        let balance = this.getLoyaltyPoints();
        balance += points;
        localStorage.setItem(this.LOYALTY_POINTS_KEY, balance.toString());

        const txs = this.getLoyaltyTransactions();
        txs.unshift({
            id: 'LTX-' + Date.now(),
            date: new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
            points: points,
            type: 'credit',
            description: `Earned on Order #${orderId}`
        });
        localStorage.setItem(this.LOYALTY_TX_KEY, JSON.stringify(txs));
    },

    requestManualReturn(orderId, payload) {
        const orders = this.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return false;
        
        const order = orders[orderIndex];
        if (order.status === 'Returned' || order.status === 'Return Requested') return false;

        order.status = 'Return Requested';
        order.returnReason = payload.reason;
        order.returnDetails = payload.details;
        order.returnImage = payload.image;
        order.refundOption = payload.refundOption;
        order.returnRequestDate = new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});

        orders[orderIndex] = order;
        localStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));
        return true;
    },

    approveReturnPickup(orderId) {
        const orders = this.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return false;
        
        const order = orders[orderIndex];
        order.status = 'Return in Transit';
        orders[orderIndex] = order;
        localStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));
        return true;
    },

    processReturnRefund(orderId, qualityCheckPassed = true) {
        const orders = this.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return false;
        
        const order = orders[orderIndex];
        order.status = 'Returned';
        order.returnDate = new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'});
        order.qualityCheckPassed = qualityCheckPassed;
        
        // 2. Restock products back into inventory (conditional on quality check passing)
        const products = this.getProducts();
        if (qualityCheckPassed && order.items && Array.isArray(order.items)) {
            order.items.forEach(itemName => {
                const product = products.find(p => p.title.toLowerCase() === itemName.toLowerCase());
                if (product) {
                    product.stock = (product.stock || 0) + 1;
                }
            });
            localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(products));
        }

        // 3. Refund based on refundOption
        if (order.refundOption === 'wallet') {
            // User requested the ENTIRE refund in Store Credit (Wallet Paid + Gateway Paid)
            const refundAmount = (order.gatewayPaid !== undefined) ? ((order.gatewayPaid || 0) + (order.walletPaid || 0)) : order.total;
            this.applyWalletCredit(refundAmount, `Manual Return Credit for Order #${orderId}`, orderId);
        } else {
            // User requested Original Payment Method. We refund walletPaid to Store Wallet, and gatewayPaid goes back to bank.
            if (order.walletPaid && order.walletPaid > 0) {
                this.applyWalletCredit(order.walletPaid, `Refund of Wallet Portion for Order #${orderId}`, orderId);
            }
            // Simulated refund of order.gatewayPaid (or order.total - order.walletPaid) to external bank account
            const bankRefund = (order.gatewayPaid !== undefined) ? order.gatewayPaid : (order.total - (order.walletPaid || 0));
            console.log(`[Refund simulation] Refunded ₹${bankRefund} to bank account for Order #${orderId}`);
        }

        // 4. Debit the loyalty points EARNED on that order from the user's points balance.
        const pointsEarned = order.pointsEarned !== undefined ? order.pointsEarned : Math.floor(order.total / 10);
        if (pointsEarned > 0) {
            let balance = this.getLoyaltyPoints();
            balance = Math.max(0, balance - pointsEarned);
            localStorage.setItem(this.LOYALTY_POINTS_KEY, balance.toString());

            const txs = this.getLoyaltyTransactions();
            txs.unshift({
                id: 'LTX-' + Date.now(),
                date: new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
                points: pointsEarned,
                type: 'debit',
                description: `Revoked for Returned Order #${orderId}`
            });
            localStorage.setItem(this.LOYALTY_TX_KEY, JSON.stringify(txs));
        }

        // 5. Restore the loyalty points SPENT/REDEEMED on that order.
        if (order.pointsRedeemed && order.pointsRedeemed > 0) {
            let balance = this.getLoyaltyPoints();
            balance += order.pointsRedeemed;
            localStorage.setItem(this.LOYALTY_POINTS_KEY, balance.toString());

            const txs = this.getLoyaltyTransactions();
            txs.unshift({
                id: 'LTX-' + (Date.now() + 1),
                date: new Date().toLocaleDateString('en-IN', {day: 'numeric', month: 'short', year: 'numeric'}),
                points: order.pointsRedeemed,
                type: 'credit',
                description: `Restored for Returned Order #${orderId}`
            });
            localStorage.setItem(this.LOYALTY_TX_KEY, JSON.stringify(txs));
        }

        // Save updated orders
        orders[orderIndex] = order;
        localStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));

        return true;
    },

    rejectReturn(orderId, rejectReason) {
        const orders = this.getOrders();
        const orderIndex = orders.findIndex(o => o.id === orderId);
        if (orderIndex === -1) return false;
        
        const order = orders[orderIndex];
        order.status = 'Return Rejected';
        order.returnRejectReason = rejectReason;
        orders[orderIndex] = order;
        localStorage.setItem(this.ORDERS_KEY, JSON.stringify(orders));
        return true;
    },

    resetPrototype() {
        localStorage.removeItem(this.PRODUCTS_KEY);
        localStorage.removeItem(this.ORDERS_KEY);
        localStorage.removeItem(this.COUPONS_KEY);
        localStorage.setItem('cartCount', '0');
        localStorage.removeItem('cart_items');
        localStorage.removeItem(this.WALLET_BALANCE_KEY);
        localStorage.removeItem(this.WALLET_TX_KEY);
        localStorage.removeItem(this.LOYALTY_POINTS_KEY);
        localStorage.removeItem(this.LOYALTY_TX_KEY);
        location.reload();
    }

};

document.addEventListener('DOMContentLoaded', () => {
    RegistryManager.init();
    initAnimations();
    initCart();
    initAdminIntelligence();
});

// --- Animations ---
function initAnimations() {
    const observerOptions = { threshold: 0.1 };
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('active');
        });
    }, observerOptions);

    // Target elements with explicit opt-in .scroll-reveal class instead of generic elements
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
}

// --- Cart Logic ---
function addProductToCart(productName, price, size, image) {
    let cart = [];
    try {
        cart = JSON.parse(localStorage.getItem('cart_items') || '[]');
    } catch(e) {
        console.error("Error parsing cart items:", e);
    }
    cart.push({ productName, price: price || 0, size: size || "M", image: image || "" });
    localStorage.setItem('cart_items', JSON.stringify(cart));
    
    let count = parseInt(localStorage.getItem('cartCount') || '0');
    localStorage.setItem('cartCount', count + 1);
    updateCartDisplay(true); // Trigger animation
}

function initCart() {
    updateCartDisplay();

    // Cross-tab sync for cart
    window.addEventListener('storage', (e) => {
        if (e.key === 'cartCount' || e.key === 'cart_items') {
            updateCartDisplay(true);
            if (window.location.pathname.includes('/shoppingbag/')) {
                location.reload();
            }
        }
    });

    document.querySelectorAll('button').forEach(btn => {
        if (btn.innerText.toLowerCase().includes('add to cart') || btn.innerText.toLowerCase().includes('buy now') || btn.innerText.toLowerCase().includes('add to bag')) {
            btn.addEventListener('click', (e) => {
                // Try to find product details from the card DOM dynamically
                let productName = "Signature Linen Shirt";
                let price = 14500;
                let image = "https://lh3.googleusercontent.com/aida-public/AB6AXuA5SFi3n0_AFFxHNg48C_fmzDxMDB7eA3s2kAeA71DAaBm_ATzhe2R_GfrrGwBIzNX3HKK4zEZgSEKQs5Jvxrk6bhNpgfmLBVvjOdG8fDRwO9JeDcL3gTu_iZVQeh4Cp4bleSO3fyprCS-iR5dGwVCtL3L-GXML1kNAv12-CiEUcxHyqNVGLWcWfVDiYn16_qqZYjq9Mjmkm13lf9HnjyMGgyG_lw2ftpstJS9uD-remW6L54WASBxhwTAIs26DeWfrrDO5P_Da5-4";
                let size = "M";

                // Find card container
                const card = btn.closest('.group, .product-card-hover, [class*="snap-start"]');
                if (card) {
                    const titleEl = card.querySelector('h3, h4');
                    const priceEl = card.querySelector('.text-secondary, font-headline, .font-bold');
                    const imgEl = card.querySelector('img');
                    
                    if (titleEl) productName = titleEl.innerText.trim();
                    if (priceEl) {
                        const rawPrice = priceEl.innerText.replace(/[^\d]/g, '');
                        if (rawPrice) price = parseInt(rawPrice);
                    }
                    if (imgEl) image = imgEl.src;
                }
                
                showToast(`${productName} added to bag`);
                addProductToCart(productName, price, size, image);
            });
        }
    });
}

// --- Cart Increment ---
function incrementCart() {
    let count = parseInt(localStorage.getItem('cartCount') || '0');
    localStorage.setItem('cartCount', count + 1);
    updateCartDisplay(true); // Trigger animation
}

// --- Cart Display Update ---
function updateCartDisplay(animate = false) {
    const count = localStorage.getItem('cartCount') || '0';
    // Comprehensive selector for all navigation and sticky cart variants
    const cartIcons = document.querySelectorAll('.cart-count, [data-icon] + span, .shopping_bag + span, .shopping_cart + span');
    
    cartIcons.forEach(el => {
        el.innerText = count;
        if (animate) {
            el.parentElement.classList.remove('cart-animate');
            void el.offsetWidth; // Force reflow
            el.parentElement.classList.add('cart-animate');
            // Clean up class after animation ends
            setTimeout(() => {
                el.parentElement.classList.remove('cart-animate');
            }, 500);
        }
    });
}

// --- Toast Notifications ---
function showToast(message) {
    let toast = document.getElementById('prototype-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'prototype-toast';
        document.body.appendChild(toast);
    }
    toast.innerText = message;
    toast.className = 'active'; // Fixed class setting
    setTimeout(() => toast.className = '', 3000);
}

// --- Admin Intelligence (Dynamic metrics) ---
function initAdminIntelligence() {
    const isDashboard = document.title.toLowerCase().includes('dashboard') || document.title.toLowerCase().includes('terminal') || document.title.toLowerCase().includes('hq');
    if (isDashboard) {
        const metrics = RegistryManager.getDashboardMetrics();
        
        // Map elements to metrics by looking at their associated labels
        document.querySelectorAll('section, div').forEach(parent => {
            const h3 = parent.querySelector('h3');
            if (h3) {
                const label = parent.innerText.toUpperCase();
                if (label.includes('REVENUE') || label.includes('SALES')) animateValue(h3, '₹' + metrics.totalRevenue.toLocaleString());
                else if (label.includes('INVENTORY') || label.includes('STOCK')) animateValue(h3, metrics.inventoryCount);
                else if (label.includes('ORDERS') || label.includes('VOLUME') || label.includes('ACQUISITION')) animateValue(h3, metrics.totalOrders);
                else if (label.includes('CONVERSION')) animateValue(h3, metrics.conversion);
            }
        });
    }
}

function animateValue(obj, endStr) {
    const finalValue = endStr;
    const numericPart = parseFloat(String(endStr).replace(/[^\d.-]/g, '')) || 0;
    const duration = 1500;
    let startTimestamp = null;

    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const current = Math.floor(progress * numericPart);
        
        // Formatting
        if (typeof endStr === 'string' && endStr.startsWith('₹')) {
            obj.innerHTML = '₹' + current.toLocaleString();
        } else if (typeof endStr === 'string' && endStr.endsWith('%')) {
            obj.innerHTML = current + '%';
        } else {
            obj.innerHTML = current.toLocaleString();
        }

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = finalValue;
        }
    };
    window.requestAnimationFrame(step);
}
