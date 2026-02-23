-- server.lua
-- Handles saving the browser links to data/links.json
-- (SaveResourceFile requires server context in FiveM)

RegisterNetEvent('redutzu-tablet:server:saveLinks', function(jsonData)
    local src = source

    -- Validate: must be a non-empty string
    -- (client.lua sends json.encode(data) so this is always a string)
    if not jsonData or type(jsonData) ~= 'string' or jsonData == '' then
        print('[redutzu-tablet] saveLinks: received invalid data from source ' .. tostring(src))
        return
    end

    -- Decode to validate JSON integrity before writing to disk
    local decoded = json.decode(jsonData)
    if not decoded or type(decoded) ~= 'table' then
        print('[redutzu-tablet] saveLinks: JSON decode failed, not saving. Source: ' .. tostring(src))
        return
    end

    -- FIX (Bug 2): FiveM's native json.encode does NOT accept a second options
    -- argument. Passing { indent = true } causes an error or undefined behaviour
    -- depending on the server version. Use json.encode with no options.
    local cleanJson = json.encode(decoded)

    local success = SaveResourceFile(GetCurrentResourceName(), 'data/links.json', cleanJson, -1)

    if success then
        -- Notify the requesting client that the save succeeded
        -- and send back the clean JSON so their NUI stays in sync
        TriggerClientEvent('redutzu-tablet:client:linksUpdated', src, cleanJson)
        print('[redutzu-tablet] saveLinks: links.json saved successfully for source ' .. tostring(src))
    else
        print('[redutzu-tablet] saveLinks: FAILED to save links.json for source ' .. tostring(src))
    end
end)