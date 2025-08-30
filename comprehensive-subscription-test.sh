#!/bin/bash

# Comprehensive Subscription State Testing Script
# Tests all discount scenarios and state transitions for QuickStage
# This script simulates various Stripe webhook scenarios to ensure robust handling

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
WORKER_BASE_URL="https://quickstage-worker.nbramia.workers.dev"
TEST_EMAIL="test-subscription@example.com"
TEST_UID="test-uid-$(date +%s)"
TEST_CUSTOMER_ID="cus_test_$(date +%s)"
TEST_SUBSCRIPTION_ID="sub_test_$(date +%s)"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_test() {
    echo -e "${PURPLE}🧪 $1${NC}"
}

print_result() {
    echo -e "${CYAN}📊 $1${NC}"
}

# Helper function to create a test user
create_test_user() {
    local uid=$1
    local email=$2
    
    print_info "Creating test user: $uid"
    
    # Create user via signup endpoint
    curl -s -X POST "$WORKER_BASE_URL/signup" \
        -H "Content-Type: application/json" \
        -d "{\"email\":\"$email\",\"password\":\"testpass123\",\"name\":\"Test User\"}" \
        > /dev/null
    
    sleep 1
}

# Helper function to get user status
get_user_status() {
    local email=$1
    
    local response=$(curl -s "$WORKER_BASE_URL/debug/user-by-email/$email" || echo "null")
    echo "$response"
}

# Helper function to simulate webhook
send_webhook() {
    local event_type=$1
    local data=$2
    
    print_info "Sending webhook: $event_type"
    
    # Create a minimal webhook payload (note: this is for testing, real webhooks need proper signatures)
    local webhook_payload="{\"type\":\"$event_type\",\"data\":{\"object\":$data}}"
    
    local response=$(curl -s -X POST "$WORKER_BASE_URL/webhook/stripe" \
        -H "Content-Type: application/json" \
        -H "stripe-signature: t=$(date +%s),v1=test_signature_for_testing" \
        -d "$webhook_payload")
    
    sleep 2  # Allow processing time
    echo "$response"
}

# Test Scenario Functions
test_scenario_1_regular_trial() {
    print_test "SCENARIO 1: Regular 7-day trial (no discount)"
    
    local test_email="trial-regular@test.com"
    local test_uid="trial-reg-$(date +%s)"
    local customer_id="cus_regular_$(date +%s)"
    local subscription_id="sub_regular_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Simulate checkout session completion (regular trial)
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":0,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    # Simulate subscription creation (trialing)
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"trialing\",
        \"trial_end\":$(($(date +%s) + 604800)),
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Check user status
    local user_status=$(get_user_status "$test_email")
    print_result "Regular Trial Result: $user_status"
    
    # Verify expected status: trial, subscriptionDisplay should be "Pro (Trial)"
    if echo "$user_status" | grep -q '"subscriptionStatus":"trial"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ Regular trial test passed"
    else
        print_error "❌ Regular trial test failed"
    fi
}

test_scenario_2_100percent_discount() {
    print_test "SCENARIO 2: 100% discount coupon (permanent Pro access)"
    
    local test_email="discount-100@test.com"
    local test_uid="disc-100-$(date +%s)"
    local customer_id="cus_100disc_$(date +%s)"
    local subscription_id="sub_100disc_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Simulate checkout session completion with 100% discount
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":0,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[{\"amount\":600}]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    # Simulate subscription creation with 100% discount
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"trialing\",
        \"trial_end\":$(($(date +%s) + 604800)),
        \"discount\":{\"coupon\":{\"percent_off\":100}}
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Check user status
    local user_status=$(get_user_status "$test_email")
    print_result "100% Discount Result: $user_status"
    
    # Verify expected status: active, subscriptionDisplay should be "Pro" (not trial)
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ 100% discount test passed"
    else
        print_error "❌ 100% discount test failed"
    fi
}

test_scenario_3_partial_discount() {
    print_test "SCENARIO 3: 50% discount coupon (trial then discounted billing)"
    
    local test_email="discount-50@test.com"
    local test_uid="disc-50-$(date +%s)"
    local customer_id="cus_50disc_$(date +%s)"
    local subscription_id="sub_50disc_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Simulate checkout session completion with 50% discount
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":0,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[{\"amount\":300}]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    # Simulate subscription creation with 50% discount
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"trialing\",
        \"trial_end\":$(($(date +%s) + 604800)),
        \"discount\":{\"coupon\":{\"percent_off\":50}}
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Check user status
    local user_status=$(get_user_status "$test_email")
    print_result "50% Discount Result: $user_status"
    
    # Verify expected status: trial (even with discount), subscriptionDisplay should be "Pro (Trial)"
    if echo "$user_status" | grep -q '"subscriptionStatus":"trial"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ 50% discount test passed"
    else
        print_error "❌ 50% discount test failed"
    fi
}

test_scenario_4_trial_to_active() {
    print_test "SCENARIO 4: Trial converts to active subscription"
    
    local test_email="trial-to-active@test.com"
    local test_uid="t2a-$(date +%s)"
    local customer_id="cus_t2a_$(date +%s)"
    local subscription_id="sub_t2a_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Step 1: Start trial
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":0,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"trialing\",
        \"trial_end\":$(($(date +%s) + 604800)),
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Verify trial status
    local user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"trial"'; then
        print_status "✅ Trial phase confirmed"
    else
        print_error "❌ Trial phase failed"
        return
    fi
    
    # Step 2: Convert to active (trial ended, payment succeeded)
    local updated_subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"active\",
        \"trial_end\":null,
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.updated" "$updated_subscription_data"
    
    # Verify active status
    user_status=$(get_user_status "$test_email")
    print_result "Trial to Active Result: $user_status"
    
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ Trial to active conversion test passed"
    else
        print_error "❌ Trial to active conversion test failed"
    fi
}

test_scenario_5_active_to_cancelled_to_reactivated() {
    print_test "SCENARIO 5: Active → Cancelled → Reactivated subscription"
    
    local test_email="active-cancel-reactive@test.com"
    local test_uid="acr-$(date +%s)"
    local customer_id="cus_acr_$(date +%s)"
    local subscription_id="sub_acr_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Step 1: Start as active subscription (skip trial)
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":600,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"active\",
        \"trial_end\":null,
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Verify active status
    local user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"'; then
        print_status "✅ Active phase confirmed"
    else
        print_error "❌ Active phase failed"
        return
    fi
    
    # Step 2: Cancel subscription
    local cancelled_subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"canceled\",
        \"trial_end\":null,
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.updated" "$cancelled_subscription_data"
    
    # Verify cancelled status
    user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"cancelled"' && echo "$user_status" | grep -q '"plan":"free"'; then
        print_status "✅ Cancellation confirmed"
    else
        print_error "❌ Cancellation failed"
        return
    fi
    
    # Step 3: Reactivate with new subscription (with 10% discount)
    local new_subscription_id="sub_reactive_$(date +%s)"
    
    local reactivation_checkout_data="{
        \"id\":\"cs_reactive_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$new_subscription_id\",
        \"amount_total\":540,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[{\"amount\":60}]}}
    }"
    
    send_webhook "checkout.session.completed" "$reactivation_checkout_data"
    
    local reactivated_subscription_data="{
        \"id\":\"$new_subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"active\",
        \"trial_end\":null,
        \"discount\":{\"coupon\":{\"percent_off\":10}}
    }"
    
    send_webhook "customer.subscription.created" "$reactivated_subscription_data"
    
    # Verify reactivation
    user_status=$(get_user_status "$test_email")
    print_result "Reactivation Result: $user_status"
    
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ Reactivation test passed"
    else
        print_error "❌ Reactivation test failed"
    fi
}

test_scenario_6_trial_cancel_resubscribe_with_coupon() {
    print_test "SCENARIO 6: Trial → Cancel → Resubscribe with partial one-time discount"
    
    local test_email="trial-cancel-coupon@test.com"
    local test_uid="tcc-$(date +%s)"
    local customer_id="cus_tcc_$(date +%s)"
    local subscription_id="sub_tcc_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Step 1: Start trial
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":0,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"trialing\",
        \"trial_end\":$(($(date +%s) + 604800)),
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Verify trial status
    local user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"trial"'; then
        print_status "✅ Initial trial confirmed"
    else
        print_error "❌ Initial trial failed"
        return
    fi
    
    # Step 2: Cancel during trial
    send_webhook "customer.subscription.deleted" "{\"id\":\"$subscription_id\",\"customer\":\"$customer_id\"}"
    
    # Verify cancellation
    user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"cancelled"' && echo "$user_status" | grep -q '"plan":"free"'; then
        print_status "✅ Trial cancellation confirmed"
    else
        print_error "❌ Trial cancellation failed"
        return
    fi
    
    # Step 3: Resubscribe with 25% one-time discount
    local new_subscription_id="sub_resub_$(date +%s)"
    
    local resub_checkout_data="{
        \"id\":\"cs_resub_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$new_subscription_id\",
        \"amount_total\":450,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[{\"amount\":150}]}}
    }"
    
    send_webhook "checkout.session.completed" "$resub_checkout_data"
    
    # For one-time discount, it goes straight to active (no trial)
    local resub_subscription_data="{
        \"id\":\"$new_subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"active\",
        \"trial_end\":null,
        \"discount\":{\"coupon\":{\"percent_off\":25,\"duration\":\"once\"}}
    }"
    
    send_webhook "customer.subscription.created" "$resub_subscription_data"
    
    # Verify resubscription
    user_status=$(get_user_status "$test_email")
    print_result "Resubscription with Coupon Result: $user_status"
    
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ Resubscription with coupon test passed"
    else
        print_error "❌ Resubscription with coupon test failed"
    fi
}

test_scenario_7_payment_failure_recovery() {
    print_test "SCENARIO 7: Active subscription → Payment failure → Recovery"
    
    local test_email="payment-fail-recover@test.com"
    local test_uid="pfr-$(date +%s)"
    local customer_id="cus_pfr_$(date +%s)"
    local subscription_id="sub_pfr_$(date +%s)"
    local invoice_id="inv_pfr_$(date +%s)"
    
    create_test_user "$test_uid" "$test_email"
    
    # Step 1: Start as active subscription
    local checkout_data="{
        \"id\":\"cs_test_$(date +%s)\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_total\":600,
        \"metadata\":{\"uid\":\"$test_uid\"},
        \"total_details\":{\"breakdown\":{\"discounts\":[]}}
    }"
    
    send_webhook "checkout.session.completed" "$checkout_data"
    
    local subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"active\",
        \"trial_end\":null,
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.created" "$subscription_data"
    
    # Verify active status
    local user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"'; then
        print_status "✅ Initial active status confirmed"
    else
        print_error "❌ Initial active status failed"
        return
    fi
    
    # Step 2: Payment fails
    local failed_invoice_data="{
        \"id\":\"$invoice_id\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_due\":600,
        \"currency\":\"usd\"
    }"
    
    send_webhook "invoice.payment_failed" "$failed_invoice_data"
    
    # Verify past_due status
    user_status=$(get_user_status "$test_email")
    if echo "$user_status" | grep -q '"subscriptionStatus":"past_due"'; then
        print_status "✅ Past due status confirmed"
    else
        print_error "❌ Past due status failed"
        return
    fi
    
    # Step 3: Payment succeeds (recovery)
    local succeeded_invoice_data="{
        \"id\":\"$invoice_id\",
        \"customer\":\"$customer_id\",
        \"subscription\":\"$subscription_id\",
        \"amount_paid\":600,
        \"currency\":\"usd\"
    }"
    
    send_webhook "invoice.payment_succeeded" "$succeeded_invoice_data"
    
    # Update subscription back to active
    local recovered_subscription_data="{
        \"id\":\"$subscription_id\",
        \"customer\":\"$customer_id\",
        \"status\":\"active\",
        \"trial_end\":null,
        \"discount\":null
    }"
    
    send_webhook "customer.subscription.updated" "$recovered_subscription_data"
    
    # Verify recovery
    user_status=$(get_user_status "$test_email")
    print_result "Payment Recovery Result: $user_status"
    
    if echo "$user_status" | grep -q '"subscriptionStatus":"active"' && echo "$user_status" | grep -q '"plan":"pro"'; then
        print_status "✅ Payment failure recovery test passed"
    else
        print_error "❌ Payment failure recovery test failed"
    fi
}

# Main test execution
main() {
    echo ""
    echo "🚀 COMPREHENSIVE QUICKSTAGE SUBSCRIPTION TESTING"
    echo "=================================================="
    echo ""
    
    print_info "Testing against: $WORKER_BASE_URL"
    print_info "Starting comprehensive subscription state testing..."
    echo ""
    
    # Run all test scenarios
    test_scenario_1_regular_trial
    echo ""
    
    test_scenario_2_100percent_discount
    echo ""
    
    test_scenario_3_partial_discount  
    echo ""
    
    test_scenario_4_trial_to_active
    echo ""
    
    test_scenario_5_active_to_cancelled_to_reactivated
    echo ""
    
    test_scenario_6_trial_cancel_resubscribe_with_coupon
    echo ""
    
    test_scenario_7_payment_failure_recovery
    echo ""
    
    print_status "🎉 COMPREHENSIVE TESTING COMPLETED!"
    echo ""
    print_info "Review the results above to ensure all scenarios are working correctly."
    print_info "Each scenario tests different discount types and state transitions."
    echo ""
}

# Run the tests
main