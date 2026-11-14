import { useState, useEffect } from "react";
import { View, ScrollView, Pressable, Modal } from "react-native";
import type { JSX } from "react";
import { Text } from "heroui-native";
import { BottomSheetHeader } from "./BottomSheetHeader";
import { AppButton as Button } from "./FormControls";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TermsTab = "terms" | "privacy" | "data";

type TermsPrivacyModalProps = {
  visible: boolean;
  onClose: () => void;
  onAccept?: () => void;
  initialTab?: TermsTab;
};

export function TermsPrivacyModal({
  visible,
  onClose,
  onAccept,
  initialTab = "terms",
}: TermsPrivacyModalProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TermsTab>(initialTab);

  useEffect(() => {
    if (visible) {
      setActiveTab(initialTab);
    }
  }, [visible, initialTab]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable className="flex-1" onPress={onClose} />

        <View
          className="bg-background rounded-t-[24px] px-5 pt-2 max-h-[86%] shadow-none"
          style={{ paddingBottom: Math.max(insets.bottom + 16, 28) }}
        >
          <View className="w-12 h-1 self-center rounded-full bg-muted/60 mb-3" />
          <BottomSheetHeader
            title="Terms & Privacy Policy"
            description="Philippine Data Privacy Act of 2012 (RA 10173) Compliance & Terms"
            onClose={onClose}
            closeLabel="Close legal terms"
            className="mb-4"
          />

          <View className="flex-row bg-muted/40 p-1 rounded-xl mb-4 items-center">
            <Pressable
              onPress={() => setActiveTab("terms")}
              className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                activeTab === "terms"
                  ? "bg-primary"
                  : "bg-transparent active:bg-muted/30"
              }`}
            >
              <Text
                className={`text-sm ${
                  activeTab === "terms"
                    ? "text-primary-foreground font-semibold"
                    : "text-muted-foreground-foreground font-medium"
                }`}
              >
                Terms
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("privacy")}
              className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                activeTab === "privacy"
                  ? "bg-primary"
                  : "bg-transparent active:bg-muted/30"
              }`}
            >
              <Text
                className={`text-sm ${
                  activeTab === "privacy"
                    ? "text-primary-foreground font-semibold"
                    : "text-muted-foreground-foreground font-medium"
                }`}
              >
                Privacy Policy
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab("data")}
              className={`flex-1 py-2.5 rounded-xl items-center justify-center ${
                activeTab === "data"
                  ? "bg-primary"
                  : "bg-transparent active:bg-muted/30"
              }`}
            >
              <Text
                className={`text-sm ${
                  activeTab === "data"
                    ? "text-primary-foreground font-semibold"
                    : "text-muted-foreground-foreground font-medium"
                }`}
              >
                Health Data
              </Text>
            </Pressable>
          </View>

          <ScrollView className="mb-4 px-1 max-h-[340px]" showsVerticalScrollIndicator={true}>
            {activeTab === "terms" && (
              <View className="gap-4">
                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    1. Acceptance of Terms & Eligibility
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    By registering, logging in, or using the Birth Monitoring System (BMS) Mobile Application, you acknowledge and agree to abide by these Terms of Service. This application is designated exclusively for expecting mothers, postpartum patients, and authorized municipal healthcare personnel to facilitate maternal care, record vital signs, schedule appointments, and coordinate medical referrals.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    2. Purpose & Scope of Healthcare Services
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    BMS acts as an electronic maternal and child health record and communication bridge between patients and authorized healthcare facilities (Rural Health Units and Barangay Health Stations in the Municipality of Silang). The platform assists in tracking pregnancy milestones, calculating gestational age, flagging potential maternal risk indicators, and sending clinic schedule notifications.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    3. Emergency Care Disclaimer
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    The BMS application is not an emergency triage or live resuscitation service. In the event of acute maternal distress, severe abdominal pain, vaginal bleeding, hypertensive crisis, or onset of active labor, do not rely solely on mobile notifications. Immediately proceed to the nearest emergency room, birthing center, or hospital facility.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    4. User Responsibilities & Account Confidentiality
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    You are responsible for ensuring that all personal, contact, and medical information provided is accurate and current. You agree to safeguard your account credentials, passwords, and verification one-time pins (OTPs). Any activity conducted through your authenticated profile remains your legal responsibility.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    5. Service Availability & Offline Operations
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    BMS provides local offline data caching to support areas with intermittent connectivity. Offline data changes will automatically synchronize once a secure internet connection is restored. We do not guarantee uninterrupted platform availability and shall not be held liable for delayed notifications arising from telecommunication disruptions.
                  </Text>
                </View>
              </View>
            )}

            {activeTab === "privacy" && (
              <View className="gap-4">
                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    1. Philippine Data Privacy Act Compliance (RA 10173)
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    The Birth Monitoring System strictly adheres to Republic Act No. 10173, also known as the Data Privacy Act of 2012 (DPA), its Implementing Rules and Regulations, and National Privacy Commission (NPC) circulars. We implement stringent organizational, physical, and technical measures to protect personal and sensitive personal information.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    2. Information We Collect
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    Under the principles of transparency and proportionality, we collect:
                  </Text>
                  <View className="gap-1 pl-2">
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">General Personal Information:</Text> Full name, residential address, mobile phone number, email address, age, civil status, and date of birth.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">Sensitive Health Information:</Text> Obstetric history (Gravida, Para, Full-term, Pre-term, Abortion, Living children), Last Menstrual Period (LMP), Estimated Date of Delivery (EDD), vital signs (blood pressure, maternal weight, body mass index, fundic height, fetal heart rate), urinalysis test results, prenatal lab screening records, clinical risk classifications (Normal, Moderate, High Risk), uploaded electronic medical records, and inter-facility referral notes.
                    </Text>
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    3. Purpose & Legal Basis of Processing
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    Data processing is executed pursuant to Section 12 and Section 13 of RA 10173 for medical treatment, public health management, and maternal safety. Specific processing intents include:
                  </Text>
                  <View className="gap-1 pl-2">
                    <Text className="text-sm text-foreground/85 leading-6">
                      • Clinical evaluation and prenatal tracking by designated midwives and doctors.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • Real-time stratification of maternal risk factors to prevent pregnancy complications.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • Delivery of automated SMS and in-app appointment alerts and supplement reminders.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • Secure coordination of referral transfers between primary health stations and hospital centers.
                    </Text>
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    4. Strict Disclosure & Third-Party Prohibition
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    Access to your medical records is strictly restricted to assigned healthcare providers directly involved in your care. We strictly do not sell, lease, trade, or distribute patient health data to advertisers, private commercial insurers, or unauthorized third parties.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    5. Storage, Security Safeguards & Data Retention
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    All network communications are secured using end-to-end TLS encryption, JSON Web Token (JWT) authorization, and encrypted offline databases. Medical records are archived in compliance with Department of Health (DOH) medical records management guidelines and are systematically purged or anonymized when retention schedules elapse.
                  </Text>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    6. Your Rights as a Data Subject
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    Under RA 10173 Section 16, you are entitled to:
                  </Text>
                  <View className="gap-1 pl-2">
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">Right to be Informed:</Text> Knowing how your data is collected and processed.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">Right to Access:</Text> Viewing your maternal health history and uploaded clinical documents.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">Right to Rectification:</Text> Correcting inaccurate, outdated, or incomplete data.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">Right to Erasure or Blocking:</Text> Requesting removal of unauthorized records.
                    </Text>
                    <Text className="text-sm text-foreground/85 leading-6">
                      • <Text className="font-semibold">Right to File a Complaint:</Text> Escalating grievances to the National Privacy Commission (NPC) at complaints@privacy.gov.ph.
                    </Text>
                  </View>
                </View>

                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    7. Data Protection Officer (DPO) Inquiries
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    For inquiries, rights enforcement, or privacy clarifications, you may reach the Data Protection Officer via the Municipal Health Office of Silang, Cavite or through your assigned Barangay Health Center.
                  </Text>
                </View>
              </View>
            )}

            {activeTab === "data" && (
              <View className="gap-4">
                <View className="gap-1">
                  <Text className="text-base font-semibold text-foreground">
                    Maternal Health Data Consent Authorization
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    Pursuant to Republic Act No. 10173 Section 13, you grant voluntary, informed, and explicit consent to the Municipal Health Office of Silang and its healthcare facilities to collect and process your sensitive health information for:
                  </Text>
                </View>

                <View className="gap-2 pl-2">
                  <Text className="text-sm text-foreground/85 leading-6">
                    • Continuous obstetric and gynecologic assessment across all pregnancy trimesters.
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    • Automated detection of pregnancy-induced hypertension, preeclampsia, gestational diabetes, and obstetric risk factors.
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    • Sending personalized SMS notifications for prenatal visits, tetanus toxoid vaccination schedules, and micronutrient supplementation.
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    • Transferring essential clinical handover records during emergency intrapartum or postpartum hospital referrals.
                  </Text>
                  <Text className="text-sm text-foreground/85 leading-6">
                    • Recording labor and delivery outcomes for newborn vital statistics and postpartum wellness monitoring.
                  </Text>
                </View>

                <Text className="text-sm text-foreground/85 leading-6">
                  You retain the authority to review your medical history at any time through the profile section of this application or through your attending healthcare professional.
                </Text>
              </View>
            )}
          </ScrollView>

          <View className="mt-2 gap-2">
            {onAccept && (
              <Button variant="primary" onPress={onAccept}>
                I Agree & Accept Terms
              </Button>
            )}

            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close terms and privacy modal"
              className="py-2.5 items-center justify-center active:opacity-70"
            >
              <Text className="text-muted-foreground-foreground text-sm font-semibold">
                Close
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

