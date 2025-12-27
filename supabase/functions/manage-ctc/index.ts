import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    
    const { action, ...params } = await req.json();
    console.log(`CTC management action: ${action}`, params);

    switch (action) {
      case 'upload': {
        if (!user) throw new Error('Unauthorized');
        
        const { noteId, fileName, fileSize, metadata } = params;
        
        // Get current version for this note
        const { data: existingFiles } = await supabaseClient
          .from('ctc_files')
          .select('version')
          .eq('note_id', noteId)
          .order('version', { ascending: false })
          .limit(1);
        
        const newVersion = existingFiles && existingFiles.length > 0 
          ? existingFiles[0].version + 1 
          : 1;
        
        // Mark previous versions as not current
        if (newVersion > 1) {
          await supabaseClient
            .from('ctc_files')
            .update({ is_current: false })
            .eq('note_id', noteId);
        }
        
        // Generate file path
        const filePath = `${user.id}/${noteId}/${Date.now()}-${fileName}`;
        
        // Get user profile for name
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('display_name, email')
          .eq('user_id', user.id)
          .single();
        
        const uploaderName = profile?.display_name || profile?.email || 'Unknown User';
        
        // Create CTC file record
        const { data: ctcFile, error: insertError } = await supabaseClient
          .from('ctc_files')
          .insert({
            note_id: noteId,
            file_path: filePath,
            file_name: fileName,
            file_size: fileSize,
            version: newVersion,
            judgment_date: metadata?.judgment_date || null,
            issuing_court: metadata?.issuing_court || null,
            bench_judge_name: metadata?.bench_judge_name || null,
            case_reference: metadata?.case_reference || null,
            uploaded_by: user.id,
            uploaded_by_name: uploaderName,
          })
          .select()
          .single();
        
        if (insertError) throw insertError;
        
        // Create audit log
        await supabaseClient.from('ctc_audit_log').insert({
          ctc_file_id: ctcFile.id,
          note_id: noteId,
          user_id: user.id,
          user_name: uploaderName,
          action: 'upload',
          details: { version: newVersion, file_name: fileName },
        });
        
        // Generate upload URL
        const { data: uploadUrl, error: urlError } = await supabaseClient.storage
          .from('ctc-documents')
          .createSignedUploadUrl(filePath);
        
        if (urlError) throw urlError;
        
        return new Response(JSON.stringify({
          ctcFile,
          uploadUrl: uploadUrl.signedUrl,
          path: uploadUrl.path,
          token: uploadUrl.token,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list': {
        const { noteId, includeHistory } = params;
        
        let query = supabaseClient
          .from('ctc_files')
          .select('*')
          .eq('note_id', noteId)
          .order('version', { ascending: false });
        
        if (!includeHistory) {
          query = query.eq('is_current', true);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-download-url': {
        const { filePath } = params;
        
        const { data, error } = await supabaseClient.storage
          .from('ctc-documents')
          .createSignedUrl(filePath, 3600); // 1 hour expiry
        
        if (error) throw error;
        
        return new Response(JSON.stringify({ url: data.signedUrl }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        if (!user) throw new Error('Unauthorized');
        
        const { fileId } = params;
        
        // Get file info first
        const { data: ctcFile, error: fetchError } = await supabaseClient
          .from('ctc_files')
          .select('*')
          .eq('id', fileId)
          .single();
        
        if (fetchError) throw fetchError;
        if (ctcFile.uploaded_by !== user.id) throw new Error('Unauthorized');
        
        // Delete from storage
        await supabaseClient.storage
          .from('ctc-documents')
          .remove([ctcFile.file_path]);
        
        // Delete record
        const { error: deleteError } = await supabaseClient
          .from('ctc_files')
          .delete()
          .eq('id', fileId);
        
        if (deleteError) throw deleteError;
        
        // Create audit log
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('display_name, email')
          .eq('user_id', user.id)
          .single();
        
        await supabaseClient.from('ctc_audit_log').insert({
          note_id: ctcFile.note_id,
          user_id: user.id,
          user_name: profile?.display_name || profile?.email || 'Unknown',
          action: 'delete',
          details: { file_name: ctcFile.file_name, version: ctcFile.version },
        });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add-comment': {
        if (!user) throw new Error('Unauthorized');
        
        const { ctcFileId, content, pageNumber } = params;
        
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('display_name, email')
          .eq('user_id', user.id)
          .single();
        
        const { data, error } = await supabaseClient
          .from('ctc_comments')
          .insert({
            ctc_file_id: ctcFileId,
            user_id: user.id,
            user_name: profile?.display_name || profile?.email || 'Unknown',
            content,
            page_number: pageNumber || null,
          })
          .select()
          .single();
        
        if (error) throw error;
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list-comments': {
        const { ctcFileId } = params;
        
        const { data, error } = await supabaseClient
          .from('ctc_comments')
          .select('*')
          .eq('ctc_file_id', ctcFileId)
          .order('created_at', { ascending: true });
        
        if (error) throw error;
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get-audit-log': {
        const { noteId } = params;
        
        const { data, error } = await supabaseClient
          .from('ctc_audit_log')
          .select('*')
          .eq('note_id', noteId)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error('Invalid action');
    }
  } catch (error) {
    console.error('Error in manage-ctc:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
