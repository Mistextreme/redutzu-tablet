-- server.lua
-- Handles saving the browser links to data/links.json
-- (SaveResourceFile requires server context in FiveM)

RegisterNetEvent('redutzu-tablet:server:saveLinks', function(jsonData)
    local src = source

    -- Basic validation: ensure it's a non-empty string
    if not jsonData or type(jsonData) ~= 'string' or jsonData == '' then
        print('[redutzu-tablet] saveLinks: received invalid data from source ' .. tostring(src))
        return
    end

    -- Attempt to decode to validate JSON integrity
    local decoded = json.decode(jsonData)
    if not decoded or type(decoded) ~= 'table' then
        print('[redutzu-tablet] saveLinks: JSON decode failed, not saving. Source: ' .. tostring(src))
        return
    end

    -- Re-encode cleanly to avoid any injected formatting
    local cleanJson = json.encode(decoded, { indent = true })

    local success = SaveResourceFile(GetCurrentResourceName(), 'data/links.json', cleanJson, -1)

    if success then
        -- Notify the requesting client that the save was successful
        -- and broadcast the updated JSON back so their NUI stays in sync
        TriggerClientEvent('redutzu-tablet:client:linksUpdated', src, cleanJson)
        print('[redutzu-tablet] saveLinks: links.json saved successfully for source ' .. tostring(src))
    else
        print('[redutzu-tablet] saveLinks: FAILED to save links.json for source ' .. tostring(src))
    end
end)
