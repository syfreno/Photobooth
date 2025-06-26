import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import axios from "axios";

const PaymentGateway = ({ onPaymentSuccess }) => {
  const navigate = useNavigate();
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("order_id");

  const packages = [
    {
      name: "BLUE",
      price: "IDR 30K",
      amount: 30000,

      features: [
        "Unlimited Photo",
        "2 Slip Photo Print", 
        "Send Photo Via Email"
      ]
    },
    {
      name: "GOLD",
      price: "IDR 50K",
      amount: 50000,

      features: [
        "Unlimited Photo",
        "4 Slip Photo Print",
        "Send Photo Via Email"
      ]
    },
    {
      name: "PLATINUM", 
      price: "IDR 80K",
      amount: 80000,

      features: [
        "Unlimited Photo",
        "6 Slip Photo Print",
        "Send Photo Via Email",
        "Add On Boomerang"
      ]
    }
  ];

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
  };

  const handleStartPayment = async () => {
    if (!selectedPackage) {
      alert("Please select a package first");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_BACKEND_URL}/initiate-payment`,
        {
          package: selectedPackage.name,
          amount: selectedPackage.amount,
          callback_url: window.location.origin + "/payment-success"
        }
      );

      if (response.data.payment_url) {
        localStorage.setItem('pendingTransaction', JSON.stringify({
          package: selectedPackage.name,
          timestamp: Date.now()
        }));
        window.location.href = response.data.payment_url;
      } else if (response.data.transaction_id) {
        await verifyPayment(response.data.transaction_id);
      }
    } catch (error) {
      alert(`Payment error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const verifyPayment = async (id) => {
  setIsVerifying(true);
  try {
    const response = await axios.get(
      `${process.env.REACT_APP_BACKEND_URL}/payment-status/${id}`
    );
    if (response.data.status === "settlement" || response.data.status === "capture") {
      onPaymentSuccess();
      localStorage.setItem("paymentVerified", "true");
      localStorage.removeItem("pendingTransaction");
      // Redirect to photobooth instead of home
      navigate("/", { replace: true });
    }
  } catch (error) {
    console.error("Payment verification failed:", error);
    setPaymentError("Failed to verify payment. Please try again.");
  } finally {
    setIsVerifying(false);
  }
};


  useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const transactionId = urlParams.get("transaction_id") || urlParams.get("order_id");
  const paymentSuccess = urlParams.get("payment") === "success";
  const transactionStatus = urlParams.get("transaction_status");

  // Jalankan verifikasi HANYA jika balik dari gateway
  if (transactionId && (paymentSuccess || transactionStatus === "settlement" || transactionStatus === "capture")) {
    verifyPayment(transactionId);
  }
}, []);


  return (
    <div className="payment-gateway">
      <div className="package-grid">
        {packages.map((pkg, index) => (
          <div
            key={index}
            className={`package-card ${selectedPackage?.name === pkg.name ? 'selected' : ''}`}
            onClick={() => handlePackageSelect(pkg)}
          >
            <h2># {pkg.name}</h2>
            <p className="price">{pkg.price}</p>
            <ul>
              {pkg.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleStartPayment();
              }}
              disabled={!selectedPackage || isLoading}
            >
              {isLoading ? 'Processing...' : 'START'}
            </button>
          </div>
        ))}
      </div>
      <div className="payment-footer">
        POWERED BY HIMATIKA UNIVERSITAS TRILOGI
      </div>
    </div>
  );
};

export default PaymentGateway;