"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ArrowLeft, 
  CheckCircle2, 
  ExternalLink, 
  Copy,
  AlertCircle,
  Smartphone,
  Key,
  Settings,
  Globe,
  Shield
} from 'lucide-react';
import Link from 'next/link';
import { toast } from '@/hooks/use-toast';

export default function WhatsAppSetupGuidePage() {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied!', description: 'Text copied to clipboard' });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/settings/whatsapp">
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Settings
            </Button>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight text-foreground font-headline">
            WhatsApp Business API Setup Guide
          </h1>
          <p className="text-muted-foreground mt-2">
            Step-by-step guide to get your WhatsApp Business API credentials
          </p>
        </div>
      </div>

      {/* Important Notice */}
      <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          <strong>Important:</strong> This guide is for WhatsApp Business API (not the regular WhatsApp Business app). 
          The API requires verification and approval from Meta, which can take 1-3 business days.
        </AlertDescription>
      </Alert>

      {/* Prerequisites */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Prerequisites
          </CardTitle>
          <CardDescription>What you need before starting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Facebook Business Account</p>
              <p className="text-sm text-muted-foreground">You need an active Facebook Business account</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Phone Number</p>
              <p className="text-sm text-muted-foreground">A phone number that is not currently registered on WhatsApp</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Business Verification</p>
              <p className="text-sm text-muted-foreground">Official business documents (registration, tax ID, etc.)</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Two-Factor Authentication</p>
              <p className="text-sm text-muted-foreground">Enable 2FA on your Facebook account for security</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-Step Guide */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Step-by-Step Setup</h2>

        {/* Step 1 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">1</Badge>
              <div>
                <CardTitle>Create a Meta Business Account</CardTitle>
                <CardDescription>Set up your business presence on Meta platforms</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">
                Go to{' '}
                <a 
                  href="https://business.facebook.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  business.facebook.com
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li className="text-sm">Click <strong>"Create Account"</strong> in the top right corner</li>
              <li className="text-sm">Enter your business name, your name, and business email</li>
              <li className="text-sm">Complete the business details form (address, phone, website)</li>
              <li className="text-sm">Verify your business email address</li>
            </ol>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Use official business information. Meta may verify this against public records.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 2 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">2</Badge>
              <div>
                <CardTitle>Access WhatsApp Business Platform</CardTitle>
                <CardDescription>Navigate to the WhatsApp API section</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">
                From your Business Manager, go to{' '}
                <a 
                  href="https://business.facebook.com/wa/manage/home/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  WhatsApp Manager
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li className="text-sm">Click <strong>"Get Started"</strong> or <strong>"Create a WhatsApp Business Account"</strong></li>
              <li className="text-sm">Select your Facebook Business Account from the dropdown</li>
              <li className="text-sm">Create a new WhatsApp Business Account or select an existing one</li>
            </ol>
          </CardContent>
        </Card>

        {/* Step 3 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">3</Badge>
              <div>
                <CardTitle>Add a Phone Number</CardTitle>
                <CardDescription>Register your business phone number</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">In WhatsApp Manager, click <strong>"Phone Numbers"</strong> in the left menu</li>
              <li className="text-sm">Click <strong>"Add Phone Number"</strong></li>
              <li className="text-sm">Enter your business phone number (must not be registered on WhatsApp)</li>
              <li className="text-sm">Choose verification method (SMS or Voice Call)</li>
              <li className="text-sm">Enter the 6-digit verification code you receive</li>
              <li className="text-sm">Set up your business profile (name, category, description, photo)</li>
            </ol>
            <Alert>
              <Smartphone className="h-4 w-4" />
              <AlertDescription>
                <strong>Important:</strong> Once verified, this number cannot be used with regular WhatsApp. 
                It's dedicated to the WhatsApp Business API.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 4 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">4</Badge>
              <div>
                <CardTitle>Get Your Phone Number ID</CardTitle>
                <CardDescription>This is the first credential you need</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">Go to <strong>WhatsApp Manager → Phone Numbers</strong></li>
              <li className="text-sm">Click on your phone number</li>
              <li className="text-sm">Find the <strong>"Phone Number ID"</strong> (usually a 15-digit number)</li>
              <li className="text-sm">Copy this ID - you'll need it for configuration</li>
            </ol>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Example: 123456789012345</span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => copyToClipboard('123456789012345')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 5 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">5</Badge>
              <div>
                <CardTitle>Create a System User & Access Token</CardTitle>
                <CardDescription>Generate permanent API credentials</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Key className="h-4 w-4" />
                Create System User
              </h4>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="text-sm">
                  Go to{' '}
                  <a 
                    href="https://business.facebook.com/settings/system-users" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Business Settings → System Users
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li className="text-sm">Click <strong>"Add"</strong> and create a system user (e.g., "API User")</li>
                <li className="text-sm">Choose <strong>"Admin"</strong> role for full access</li>
                <li className="text-sm">Click <strong>"Create System User"</strong></li>
              </ol>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Generate Access Token
              </h4>
              <ol className="space-y-3 list-decimal list-inside">
                <li className="text-sm">Click on the system user you just created</li>
                <li className="text-sm">Click <strong>"Generate New Token"</strong></li>
                <li className="text-sm">Select your WhatsApp Business Account App</li>
                <li className="text-sm">
                  Select these permissions:
                  <ul className="ml-8 mt-2 space-y-1 list-disc">
                    <li className="text-sm"><code className="text-xs bg-muted px-1 py-0.5 rounded">whatsapp_business_management</code></li>
                    <li className="text-sm"><code className="text-xs bg-muted px-1 py-0.5 rounded">whatsapp_business_messaging</code></li>
                  </ul>
                </li>
                <li className="text-sm">Set token expiration to <strong>"Never"</strong> (permanent token)</li>
                <li className="text-sm">Click <strong>"Generate Token"</strong></li>
                <li className="text-sm">Copy and save this token immediately - you won't see it again!</li>
              </ol>
            </div>

            <Alert className="border-red-500 bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500" />
              <AlertDescription className="text-red-800 dark:text-red-200">
                <strong>Critical:</strong> Save this access token securely. It provides full access to your WhatsApp API. 
                Never share it publicly or commit it to version control.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 6 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">6</Badge>
              <div>
                <CardTitle>Get Your Business Account ID</CardTitle>
                <CardDescription>Find your WhatsApp Business Account ID</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">In WhatsApp Manager, click <strong>"Settings"</strong> (gear icon)</li>
              <li className="text-sm">Look for <strong>"WhatsApp Business Account ID"</strong></li>
              <li className="text-sm">This is usually a 15-digit number (different from Phone Number ID)</li>
              <li className="text-sm">Copy this ID for configuration</li>
            </ol>
          </CardContent>
        </Card>

        {/* Step 7 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">7</Badge>
              <div>
                <CardTitle>Get Your App Secret (Recommended for Production)</CardTitle>
                <CardDescription>Secure your webhook with signature verification</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The App Secret is used to verify that webhook requests are genuinely from Meta/WhatsApp, preventing unauthorized access.
            </p>
            <ol className="space-y-3 list-decimal list-inside">
              <li className="text-sm">
                Go to{' '}
                <a 
                  href="https://developers.facebook.com/apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Meta for Developers
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li className="text-sm">Select your WhatsApp Business App</li>
              <li className="text-sm">Go to <strong>Settings → Basic</strong> in the left sidebar</li>
              <li className="text-sm">Find the <strong>"App Secret"</strong> field</li>
              <li className="text-sm">Click <strong>"Show"</strong> (you may need to re-enter your Facebook password)</li>
              <li className="text-sm">Copy this secret - you'll add it to PMS settings</li>
            </ol>
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
              <Shield className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <strong>Optional but Recommended:</strong> While the App Secret is optional for testing, 
                it's highly recommended for production to ensure webhook security. Without it, your webhook 
                will accept all requests (less secure but works for development).
              </AlertDescription>
            </Alert>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">Security Levels:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500">⚠️</span>
                  <span><strong>Without App Secret:</strong> Webhooks work but are not verified (development only)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500">✅</span>
                  <span><strong>With App Secret:</strong> All webhook requests are cryptographically verified (production-ready)</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Step 8 */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1">8</Badge>
              <div>
                <CardTitle>Configure Webhook</CardTitle>
                <CardDescription>Enable two-way communication with guests</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Webhooks allow you to receive incoming messages from guests. This is optional but recommended for full functionality.
            </p>
            
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Key className="h-4 w-4" />
                Part A: Create Your Webhook Verify Token
              </h4>
              <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20">
                <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  This is a <strong>custom token you create yourself</strong> - it's NOT from Meta. 
                  Think of it as a password that Meta will use to verify they're connecting to the right endpoint.
                </AlertDescription>
              </Alert>
              <div className="space-y-3">
                <p className="text-sm font-medium">How to create it:</p>
                <ol className="space-y-2 list-decimal list-inside text-sm">
                  <li>Create a random string of at least 20 characters</li>
                  <li>
                    You can use a password generator or create something like: 
                    <code className="block bg-muted p-2 rounded mt-1 text-xs">myHotel2026_SecureToken_abc123xyz</code>
                  </li>
                  <li>
                    <strong>Save this token securely</strong> - you'll need to:
                    <ul className="ml-6 mt-1 space-y-1 list-disc">
                      <li>Enter it in the PMS WhatsApp settings page</li>
                      <li>Enter it in Meta's webhook configuration (next step)</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Part B: Configure Webhook in Meta
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Now you'll tell Meta where to send webhook events (incoming messages, delivery receipts, etc.)
              </p>
              <ol className="space-y-4 list-decimal list-inside">
                <li className="text-sm">
                  <div className="ml-6">
                    <p className="font-medium mb-2">Navigate to Your App Settings:</p>
                    <ul className="space-y-1 list-disc text-sm text-muted-foreground">
                      <li>
                        Go to{' '}
                        <a 
                          href="https://developers.facebook.com/apps" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Meta for Developers
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </li>
                      <li>Select your <strong>WhatsApp Business App</strong> from the list</li>
                      <li>In the left sidebar, find and click <strong>"WhatsApp"</strong> (under Products)</li>
                      <li>Click on <strong>"Configuration"</strong> under the WhatsApp section</li>
                    </ul>
                    <Alert className="mt-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>Alternative path:</strong> Some accounts may find webhook settings under 
                        <strong> Webhooks</strong> in the left sidebar of the app dashboard, or under 
                        <strong> App Settings → Basic → Webhooks</strong>.
                      </AlertDescription>
                    </Alert>
                  </div>
                </li>
                
                <li className="text-sm">
                  <div className="ml-6">
                    <p className="font-medium mb-2">Edit Webhook Configuration:</p>
                    <ul className="space-y-1 list-disc text-sm text-muted-foreground">
                      <li>Scroll down to find the <strong>"Webhook"</strong> section</li>
                      <li>Click <strong>"Edit"</strong> or <strong>"Configure webhook"</strong> button</li>
                      <li>If you don't see this option, look for <strong>"Set up webhook"</strong></li>
                    </ul>
                  </div>
                </li>
                
                <li className="text-sm">
                  <div className="ml-6">
                    <p className="font-medium mb-2">Enter the Callback URL:</p>
                    <div className="bg-muted p-3 rounded-lg font-mono text-xs break-all">
                      https://europe-west1-protrack-hub.cloudfunctions.net/whatsappWebhook
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Where this URL comes from:</strong> This is automatically generated by your PMS. 
                      The URL format is always the same for all users of this PMS system.
                    </p>
                  </div>
                </li>
                
                <li className="text-sm">
                  <div className="ml-6">
                    <p className="font-medium mb-2">Enter Your Verify Token:</p>
                    <p className="text-muted-foreground mb-2">
                      Paste the <strong>custom token you created in Part A</strong> above into the "Verify token" field.
                    </p>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        This must match <strong>exactly</strong> what you'll enter in the PMS settings. 
                        Copy-paste to avoid typos.
                      </AlertDescription>
                    </Alert>
                  </div>
                </li>
                
                <li className="text-sm">
                  <div className="ml-6">
                    <p className="font-medium mb-2">Click "Verify and Save":</p>
                    <p className="text-muted-foreground mb-2">
                      Meta will send a verification request to your webhook URL. If everything is correct, you'll see a success message.
                    </p>
                    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        <strong>Note:</strong> The webhook must already be saved in your PMS settings BEFORE 
                        clicking "Verify and Save" in Meta. Otherwise, Meta won't be able to verify the connection.
                      </AlertDescription>
                    </Alert>
                  </div>
                </li>
                
                <li className="text-sm">
                  <div className="ml-6">
                    <p className="font-medium mb-2">Subscribe to Webhook Fields:</p>
                    <p className="text-muted-foreground mb-2">After verification succeeds, select which events to receive:</p>
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start gap-2 bg-muted p-2 rounded">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <code className="text-xs font-semibold">messages</code>
                          <p className="text-xs text-muted-foreground">Receive incoming messages from guests</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-muted p-2 rounded">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <code className="text-xs font-semibold">message_status</code>
                          <p className="text-xs text-muted-foreground">Track delivery, read receipts, and failed messages</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Click the checkbox next to each field to subscribe.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <Separator />

            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Part C: Security Summary
              </h4>
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">What each security component does:</p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <Key className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>Webhook Verify Token:</strong> Verifies the webhook endpoint during initial setup. 
                      You create this yourself and share it with Meta.
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    <Shield className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <strong>App Secret (from Step 7):</strong> Verifies each incoming webhook request is from Meta. 
                      This is provided by Meta and stored in your PMS.
                    </div>
                  </li>
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  Together, these ensure that only Meta can send webhooks to your system, and your system 
                  only accepts webhooks from Meta.
                </p>
              </div>
            </div>

            <Alert>
              <Globe className="h-4 w-4" />
              <AlertDescription>
                The webhook is automatically secured with your App Secret (from Step 7) if you configured it. 
                All incoming requests are cryptographically verified to ensure they're from Meta.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Step 9 */}
        <Card className="border-green-500 bg-green-50 dark:bg-green-950/20">
          <CardHeader>
            <div className="flex items-start gap-4">
              <Badge className="text-lg px-3 py-1 bg-green-600">9</Badge>
              <div>
                <CardTitle className="text-green-800 dark:text-green-200">Enter Credentials in PMS</CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  You're ready to configure WhatsApp in your PMS!
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-800 dark:text-green-200">
              Now that you have all the credentials, return to the WhatsApp settings page and enter:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Phone Number ID</p>
                  <p className="text-sm text-green-700 dark:text-green-300">From Step 4 - Your WhatsApp phone number identifier</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Access Token</p>
                  <p className="text-sm text-green-700 dark:text-green-300">From Step 5 - Your permanent API access token</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Business Account ID</p>
                  <p className="text-sm text-green-700 dark:text-green-300">From Step 6 - Your WhatsApp Business Account identifier</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">Webhook Verify Token</p>
                  <p className="text-sm text-green-700 dark:text-green-300">From Step 8 - Your custom verification token</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="h-5 px-2 text-xs bg-amber-100 border-amber-300 text-amber-800 mt-0.5 flex-shrink-0">
                  Optional
                </Badge>
                <div>
                  <p className="font-medium text-green-900 dark:text-green-100">App Secret</p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    From Step 7 - Recommended for production security. Leave empty for testing.
                  </p>
                </div>
              </div>
            </div>
            <Alert className="border-blue-500 bg-blue-50 dark:bg-blue-950/20 mt-4">
              <Shield className="h-4 w-4 text-blue-600 dark:text-blue-500" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <strong>Security Tip:</strong> Each property in your PMS has its own independent WhatsApp configuration. 
                This means each hotel can use different WhatsApp accounts with their own security credentials.
              </AlertDescription>
            </Alert>
            <Link href="/settings/whatsapp">
              <Button className="w-full mt-4">
                Go to WhatsApp Settings
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>Official documentation and support</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <a 
            href="https://developers.facebook.com/docs/whatsapp/business-management-api/get-started" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            WhatsApp Business API Documentation
          </a>
          <a 
            href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            WhatsApp Cloud API Getting Started
          </a>
          <a 
            href="https://business.facebook.com/business/help" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Meta Business Help Center
          </a>
        </CardContent>
      </Card>

      {/* Troubleshooting */}
      <Card>
        <CardHeader>
          <CardTitle>Common Issues & Solutions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Phone number already registered</h4>
            <p className="text-sm text-muted-foreground">
              The number must be unregistered from all WhatsApp accounts (personal and business). 
              Unregister it from the WhatsApp app before adding to the API.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Access token expired</h4>
            <p className="text-sm text-muted-foreground">
              Make sure to set the token expiration to "Never" when generating. 
              If it expires, generate a new permanent token following Step 5.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Business verification required</h4>
            <p className="text-sm text-muted-foreground">
              Some features require business verification. Submit official documents through Business Manager → Security Center → Start Verification.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Message template rejected</h4>
            <p className="text-sm text-muted-foreground">
              Templates must follow WhatsApp policies. Avoid promotional content in UTILITY templates. 
              Use clear, professional language and follow the examples in Meta's documentation.
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Webhook signature verification failed</h4>
            <p className="text-sm text-muted-foreground">
              If you're seeing signature errors in logs, verify that:
            </p>
            <ul className="ml-6 mt-2 space-y-1 list-disc text-sm text-muted-foreground">
              <li>The App Secret in PMS settings matches exactly what's in Meta for Developers</li>
              <li>You copied the App Secret correctly without extra spaces</li>
              <li>The App Secret hasn't been regenerated in Meta (which would invalidate the old one)</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-2">
              <strong>For testing:</strong> You can leave the App Secret field empty and webhooks will work without verification (not recommended for production).
            </p>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-2">Connection test fails</h4>
            <p className="text-sm text-muted-foreground">
              Double-check that you've entered the correct Phone Number ID and Access Token. 
              The most common mistake is confusing Phone Number ID with Business Account ID - they are different numbers.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
