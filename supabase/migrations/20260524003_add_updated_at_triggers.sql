-- Add updated_at trigger to users table
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger to properties table if not exists
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
