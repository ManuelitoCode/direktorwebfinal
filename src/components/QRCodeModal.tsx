import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Share2, QrCode, Copy, Check } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { supabase } from '../lib/supabase';
import { useAuditLog } from '../hooks/useAuditLog';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  tournamentName: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({
  isOpen,
  onClose,
  tournamentId,
  tournamentName
}) => {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tournamentSlug, setTournamentSlug] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { logAction } = useAuditLog();

  useEffect(() => {
    if (isOpen && tournamentId) {
      loadTournamentSlug();
    }
  }, [isOpen, tournamentId]);
  
  const loadTournamentSlug = async () => {
    try {
      // Get tournament slug
      const { data, error } = await supabase
        .from('tournaments')
        .select('slug')
        .eq('id', tournamentId)
        .single();
        
      if (error) throw error;
      
      setTournamentSlug(data.slug);
      generateQRCode(data.slug);
    } catch (err) {
      console.error('Error loading tournament slug:', err);
      // Fallback to ID
      generateQRCode(null);
    }
  };

  const generateQRCode = async (slug: string | null) => {
    try {
      setIsGenerating(true);
      
      // Use slug if available, otherwise use ID
      const tournamentUrl = `https://direktorweb.com/tournaments/${slug || tournamentId}`;
      
      // Generate QR code with custom styling
      const qrCodeDataUrl = await QRCodeLib.toDataURL(tournamentUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#1e40af', // Blue color
          light: '#ffffff'  // White background
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrCodeDataUrl(qrCodeDataUrl);
      
      // Log QR code generation
      logAction({
        action: 'qr_code_generated',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentName,
          url_type: slug ? 'slug' : 'id'
        }
      });
    } catch (err) {
      console.error('Error generating QR code:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataUrl) return;

    const link = document.createElement('a');
    link.download = `${tournamentName.replace(/[^a-z0-9]/gi, '_')}_QR_Code.png`;
    link.href = qrCodeDataUrl;
    link.click();
    
    // Log download
    logAction({
      action: 'qr_code_downloaded',
      details: {
        tournament_id: tournamentId,
        tournament_name: tournamentName
      }
    });
  };

  const shareQRCode = async () => {
    if (!qrCodeDataUrl) return;

    try {
      // Convert data URL to blob
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `${tournamentName}_QR_Code.png`, { type: 'image/png' });
        
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `${tournamentName} - Tournament QR Code`,
            text: `Scan this QR code to view the live tournament: ${tournamentName}`,
            files: [file]
          });
          
          // Log share
          logAction({
            action: 'qr_code_shared',
            details: {
              tournament_id: tournamentId,
              tournament_name: tournamentName,
              share_method: 'web_share_api'
            }
          });
          
          return;
        }
      }
      
      // Fallback: copy to clipboard
      await copyToClipboard();
    } catch (err) {
      console.error('Error sharing QR code:', err);
      // Fallback to copy URL
      await copyToClipboard();
    }
  };

  const copyToClipboard = async () => {
    try {
      const tournamentUrl = `https://direktorweb.com/tournaments/${tournamentSlug || tournamentId}`;
      await navigator.clipboard.writeText(tournamentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      // Log copy
      logAction({
        action: 'tournament_link_copied',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentName,
          url_type: tournamentSlug ? 'slug' : 'id'
        }
      });
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyQRImage = async () => {
    if (!qrCodeDataUrl) return;

    try {
      const response = await fetch(qrCodeDataUrl);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ]);
      
      // Show success message
      const toast = document.createElement('div');
      toast.className = 'fixed top-4 right-4 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg font-jetbrains text-sm';
      toast.textContent = 'QR code copied to clipboard!';
      document.body.appendChild(toast);
      
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 3000);
      
      // Log QR image copy
      logAction({
        action: 'qr_code_image_copied',
        details: {
          tournament_id: tournamentId,
          tournament_name: tournamentName
        }
      });
    } catch (err) {
      console.error('Failed to copy QR code image:', err);
      // Fallback to copying URL
      await copyToClipboard();
    }
  };

  if (!isOpen) return null;

  const tournamentUrl = `https://direktorweb.com/tournaments/${tournamentSlug || tournamentId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-gray-900/95 backdrop-blur-lg border-2 border-blue-500/50 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b-2 border-blue-500/30 bg-gradient-to-r from-blue-900/30 to-purple-900/30">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white font-orbitron">
                Tournament QR Code
              </h2>
              <p className="text-blue-300 font-jetbrains">
                Share your tournament instantly
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-all duration-200"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Tournament Info */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white font-orbitron mb-2">
              {tournamentName}
            </h3>
            <p className="text-gray-400 font-jetbrains">
              Scan to view live tournament results
            </p>
          </div>

          {/* QR Code Display */}
          <div className="flex justify-center mb-8">
            {isGenerating ? (
              <div className="w-80 h-80 bg-gray-800/50 border-2 border-gray-600 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-400 font-jetbrains">Generating QR Code...</p>
                </div>
              </div>
            ) : qrCodeDataUrl ? (
              <div className="relative group">
                <div className="bg-white p-6 rounded-xl shadow-lg">
                  <img 
                    src={qrCodeDataUrl} 
                    alt="Tournament QR Code"
                    className="w-80 h-80 object-contain"
                  />
                </div>
                
                {/* Copy QR Image Button */}
                <button
                  onClick={copyQRImage}
                  className="absolute top-2 right-2 p-2 bg-black/70 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/90"
                  title="Copy QR code image"
                >
                  <Copy size={16} />
                </button>
              </div>
            ) : (
              <div className="w-80 h-80 bg-gray-800/50 border-2 border-gray-600 rounded-xl flex items-center justify-center">
                <p className="text-gray-400 font-jetbrains">Failed to generate QR code</p>
              </div>
            )}
          </div>

          {/* Tournament URL */}
          <div className="bg-gray-800/50 border border-gray-600 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between">
              <div className="flex-1 mr-4">
                <p className="text-sm text-gray-400 font-jetbrains mb-1">Tournament URL:</p>
                <p className="text-white font-jetbrains text-sm break-all">
                  {tournamentUrl}
                </p>
              </div>
              
              <button
                onClick={copyToClipboard}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-jetbrains font-medium transition-all duration-200 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {copied ? (
                  <>
                    <Check size={16} />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    Copy URL
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={downloadQRCode}
              disabled={!qrCodeDataUrl}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-jetbrains font-medium transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              <Download size={20} />
              Download QR Code
            </button>
            
            <button
              onClick={shareQRCode}
              disabled={!qrCodeDataUrl}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl font-jetbrains font-medium transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              <Share2 size={20} />
              Share QR Code
            </button>
          </div>

          {/* Instructions */}
          <div className="mt-8 bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <h4 className="text-lg font-bold text-blue-300 font-orbitron mb-2">
              📱 How to Use
            </h4>
            <ul className="text-sm text-gray-300 font-jetbrains space-y-1">
              <li>• Print the QR code and display it at your tournament venue</li>
              <li>• Players and spectators can scan it to view live results</li>
              <li>• The link works on any device with internet access</li>
              <li>• Results update automatically as games are completed</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;